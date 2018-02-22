import { Observable } from 'rxjs/Observable';
import { Observer } from 'rxjs/Observer';
import { Subject } from 'rxjs/Subject';
import { AnonymousSubscription } from 'rxjs/Subscription'

import { IEvent, IProtocolHandler } from './types';
import Frame from './frame';
import { IWebSocket } from './client';
import { ConnectedHeaders, ConnectionHeaders, DisconnectHeaders,
         SubscribeHeaders, UnsubscribeHeaders } from './headers';
import { unicodeStringToTypedArray } from './utils';
import Heartbeat, { HeartbeatOptions } from './heartbeat';
import stompProtocolHandler from './protocol/stomp/stompHandler';


export interface Subscription {
    id: string;
    unsubscribe: () => void;
}

export interface WsOptions {
    binary: boolean;
    heartbeat: HeartbeatOptions | boolean;
    debug: boolean;
}

export interface IConnectedObservable {
    messageReceipted: Observable<Frame>,
    errorReceived: Observable<Frame>,
    subscribeTo: (headers: SubscribeHeaders) => Observable<Frame>,
    messageSender: Subject<any>,
    protocolHandler: IProtocolHandler
}

// STOMP Client Class
//
// All STOMP protocol is exposed as methods of this class ('connect()',
// 'send()', etc.)
class WebSocketHandler {

    private ws: IWebSocket
    private isBinary: boolean
    private hasDebug: boolean
    private connected: boolean
    private maxWebSocketFrameSize: number
    private createWS: Function

    private heartbeatSettings: HeartbeatOptions
    private heartbeat: Heartbeat
    private protocolHandler: IProtocolHandler

    constructor(createWsConnection: () => IWebSocket, options: WsOptions) {

        // cannot have default options object + destructuring in the same time in method signature
        let {binary = false, debug = false, heartbeat = {outgoing: 10000, incoming: 10000}} = options;
        this.hasDebug = !!debug;
        this.connected = false;
        // Heartbeat properties of the client
        // outgoing: send heartbeat every 10s by default (value is in ms)
        // incoming: expect to receive server heartbeat at least every 10s by default
        // falsy value means no heartbeat hence 0,0
        this.heartbeatSettings = (heartbeat as HeartbeatOptions) || {outgoing: 0, incoming: 0};
        this.heartbeat = new Heartbeat(this.heartbeatSettings, this._debug);

        this.createWS = createWsConnection;

        this.isBinary = !!binary;
        // maximum *IWebSocket* frame size sent by the client. If the STOMP frame
        // is bigger than this value, the STOMP frame will be sent using multiple
        // IWebSocket frames (default is 16KiB)
        this.maxWebSocketFrameSize = 16 * 1024;

        this.protocolHandler = stompProtocolHandler(this._debug);

    }

    public initConnection = (headers: ConnectionHeaders): Observable<IConnectedObservable> => {

        return Observable.create((connectionObserver: Observer<IConnectedObservable>) => {
            if (this.ws) {
                throw 'Error, the connection has already been created !'
            }
            this.ws = this.createWS();
            if (!this.ws) {
                throw 'Error, createWsConnection function returned null !'
            }
            this.ws.binaryType = 'arraybuffer';

            // Creating the Observables
            const messageReceived = new Subject()
            const subscribeTo = (headers: SubscribeHeaders) => {
                this._send(this.protocolHandler.subscribe(headers));
                return messageReceived.finally(() => this.ws && this._send(this.protocolHandler.unSubscribe({id: headers.id})));
            }

            const messageReceipted = new Subject()
            const errorReceived = new Subject()
            const messageSender = new Subject()
            let inputSubscription: AnonymousSubscription

            const frameHandlerFn = this.protocolHandler.handleFrame(
                (_headers: ConnectedHeaders) => {
                    this._debug(`connected to server ${_headers.server}`);
                    this.connected = true;
                    inputSubscription = messageSender.subscribe(this._send)
                    connectionObserver.next({subscribeTo, messageReceipted, errorReceived, messageSender, protocolHandler: this.protocolHandler});
                    this._setupHeartbeat(this.ws, _headers);
                },
                (frame: Frame, messageID: string, subscription: string) => {
                    frame.ack = () => this._send(this.protocolHandler.ack(messageID, subscription));
                    frame.nack = () => this._send(this.protocolHandler.nack(messageID, subscription));
                    messageReceived.next(frame)
                },
                messageReceipted.next,
                errorReceived.next);

            this._debug('Opening Web Socket...');
            this.ws.onmessage = (evt: IEvent) => {
                this.heartbeat.activityFromServer();
                const dataFrames = this.protocolHandler.parseMessageReceived(evt);
                dataFrames && dataFrames.forEach(frameHandlerFn);
            };

            this.ws.onclose = (ev: CloseEvent) => {
                this._debug(`Whoops! Lost connection to ${this.ws.url}:`, ev);
                this.heartbeat.stopHeartbeat();
                this.ws = null;
                this.connected = false;
                connectionObserver.error(ev);
            };

            this.ws.onopen = () => {
                this._debug('Web Socket Opened...');
                // Check if we already have heart-beat in headers before adding them
                if (!headers['heart-beat']) {
                    headers['heart-beat'] = [this.heartbeatSettings.outgoing, this.heartbeatSettings.incoming].join(',');
                }
                this._send(this.protocolHandler.connect(headers));
            };

            return () => {
                messageReceived.complete()
                messageReceipted.complete()
                errorReceived.complete()
                inputSubscription && inputSubscription.unsubscribe()
                this.disconnect()
            }

        })

    }

    // Heart-beat negotiation
    private _setupHeartbeat = (ws: IWebSocket, headers: ConnectedHeaders) => {
        const send = (data: any) => this._wsSend(ws, data);
        this.heartbeat.startHeartbeat(headers,
                                      { send, close: () => ws.close()});
    }

    public disconnect = (headers: DisconnectHeaders = {}) => {
        this.heartbeat.stopHeartbeat();
        if (this.ws) {
            this.ws.onclose = null;
            this.connected && this._send(this.protocolHandler.disconnect(headers));
            this.connected = false;
            this.ws.close();
            this.ws = null;
        }
    }

    // Base method to transmit any stomp frame
    private _send = (data: any) => {
        if (!this.ws) {
            throw 'Error, this.ws is null ! Possibly initConnection has not been called or not subscribed !';
        }
        this._debug(`>>> ${data}`);
        this._wsSend(this.ws, data);
    }

    private _wsSend = (ws: IWebSocket, data: any) => {
        if (this.isBinary) data = unicodeStringToTypedArray(data);
        this._debug(`>>> length ${data.length}`);
        // if necessary, split the *STOMP* frame to send it on many smaller
        // *IWebSocket* frames
        while (true) {
            if (data.length > this.maxWebSocketFrameSize) {
                ws.send(data.slice(0, this.maxWebSocketFrameSize));
                data = data.slice(this.maxWebSocketFrameSize);
                this._debug(`remaining = ${data.length}`);
            } else {
                return ws.send(data);
            }
        }
    }

    private _debug = (message: any, ...args: any[]) => {
        if (this.hasDebug) console.log(message, ...args);
    }

}

export default WebSocketHandler;

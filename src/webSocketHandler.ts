import { Observable } from 'rxjs/Observable';
import { Observer } from 'rxjs/Observer';
import { Subject } from 'rxjs/Subject';
import { AnonymousSubscription } from 'rxjs/Subscription'

import { IEvent, IWebSocketObservable } from './types';
import Frame from './frame';
import { IWebSocket } from './client';
import { ConnectedHeaders, ConnectionHeaders, DisconnectHeaders,
         SubscribeHeaders, UnsubscribeHeaders } from './headers';
import { unicodeStringToTypedArray } from './utils';
import { HeartbeatOptions } from './heartbeat';


export interface Subscription {
    id: string;
    unsubscribe: () => void;
}

export interface WsOptions {
    binary: boolean;
    heartbeat: HeartbeatOptions | boolean;
    debug: boolean;
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

    constructor(createWsConnection: () => IWebSocket, options: WsOptions) {

        // cannot have default options object + destructuring in the same time in method signature
        let {binary = false, debug = false} = options;
        this.hasDebug = !!debug;

        this.createWS = createWsConnection;

        this.isBinary = !!binary;
        // maximum *IWebSocket* frame size sent by the client. If the STOMP frame
        // is bigger than this value, the STOMP frame will be sent using multiple
        // IWebSocket frames (default is 16KiB)
        this.maxWebSocketFrameSize = 16 * 1024;

    }

    public initConnection = (headers: ConnectionHeaders): Observable<IWebSocketObservable> => {

        return Observable.create((webSocketObserver: Observer<IWebSocketObservable>) => {
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

            const messageReceipted = new Subject()
            const messageSender = new Subject()
            let inputSubscription: AnonymousSubscription

            this.debug('Opening Web Socket...');

            this.ws.onopen = () => {
                this.debug('Web Socket Opened...');
                inputSubscription = messageSender.subscribe(this._send)
                webSocketObserver.next({messageReceived, messageSender, closeConnection: () => this.ws.close()});
            };

            this.ws.onmessage = (evt: IEvent) => {
                messageReceived.next(evt);
            };

            this.ws.onclose = (ev: CloseEvent) => {
                this.debug(`Whoops! Lost connection to ${this.ws.url}:`, ev);
                this.ws = null;
                webSocketObserver.error(ev);
            };

            return () => {
                messageReceived.complete()
                messageReceipted.complete()
                inputSubscription && inputSubscription.unsubscribe()
                this.disconnect()
            }

        })

    }

    public disconnect = (headers: DisconnectHeaders = {}) => {
        if (this.ws) {
            this.ws.onclose = null;
            this.ws.close();
            this.ws = null;
        }
    }

    // Base method to transmit any stomp frame
    private _send = (data: any) => {
        if (!this.ws) {
            throw 'Error, this.ws is null ! Possibly initConnection has not been called or not subscribed !';
        }
        this.debug(`>>> ${data}`);
        this._wsSend(this.ws, data);
    }

    private _wsSend = (ws: IWebSocket, data: any) => {
        if (this.isBinary) data = unicodeStringToTypedArray(data);
        this.debug(`>>> length ${data.length}`);
        // if necessary, split the *STOMP* frame to send it on many smaller
        // *IWebSocket* frames
        while (true) {
            if (data.length > this.maxWebSocketFrameSize) {
                ws.send(data.slice(0, this.maxWebSocketFrameSize));
                data = data.slice(this.maxWebSocketFrameSize);
                this.debug(`remaining = ${data.length}`);
            } else {
                return ws.send(data);
            }
        }
    }

    public debug = (message: any, ...args: any[]) => {
        if (this.hasDebug) console.log(message, ...args);
    }

}

export default WebSocketHandler;

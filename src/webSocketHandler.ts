import Frame from './frame';
import { IWebSocket } from './client';
import { VERSIONS, BYTES, typedArrayToUnicodeString, unicodeStringToTypedArray } from './utils';
import { Observable } from 'rxjs/Observable';
import { Observer } from 'rxjs/Observer';


export interface Subscription {
    id: string;
    unsubscribe: () => void;
}

export interface Heartbeat {
    outgoing: number,
    incoming: number
}

export interface IEvent {
    data: any
}

export interface WsOptions {
    binary: boolean;
    heartbeat: Heartbeat | boolean;
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
    private counter: number
    private connected: boolean
    private maxWebSocketFrameSize: number
    private serverActivity: number
    private partialData: string
    private heartbeat: Heartbeat
    private createWS: Function

    private version: any
    private pinger: any
    private ponger: any

    public onMessageReceived: (subscription: string) => (Frame) => void
    public onMessageReceipted: () => (Frame) => void
    public onErrorReceived: () => (Frame) => void
    public onConnectionError: () => (ev: any) => void

    constructor(createWsConnection: () => IWebSocket, options: WsOptions) {

        // cannot have default options object + destructuring in the same time in method signature
        let {binary = false, heartbeat = {outgoing: 10000, incoming: 10000}, debug = false} = options;
        this.hasDebug = !!debug;
        this.connected = false;
        // Heartbeat properties of the client
        // outgoing: send heartbeat every 10s by default (value is in ms)
        // incoming: expect to receive server heartbeat at least every 10s by default
        // falsy value means no heartbeat hence 0,0
        this.heartbeat = (heartbeat as Heartbeat) || {outgoing: 0, incoming: 0};
        this.partialData = '';
        this.createWS = createWsConnection;

        this.isBinary = !!binary;
        // used to index subscribers
        this.counter = 0;
        // maximum *IWebSocket* frame size sent by the client. If the STOMP frame
        // is bigger than this value, the STOMP frame will be sent using multiple
        // IWebSocket frames (default is 16KiB)
        this.maxWebSocketFrameSize = 16 * 1024;
    }

    public initConnection = (headers: any,
                    onDisconnect: (ev: any) => void
                    ): Observable<void> => {

        return Observable.create((observer: Observer<void>) => {
            if (this.ws) {
                throw 'Error, the connection has already been created !'
            }
            this.ws = this.createWS();
            if (!this.ws) {
                throw 'Error, createWsConnection function returned null !'
            }
            this.ws.binaryType = 'arraybuffer';

            this._debug('Opening Web Socket...');
            this.ws.onmessage = (evt: IEvent) => {
                let data = evt.data;
                if (evt.data instanceof ArrayBuffer) {
                    data = typedArrayToUnicodeString(new Uint8Array(evt.data));
                }
                this.serverActivity = Date.now();
                // heartbeat
                if (data === BYTES.LF) {
                    this._debug(`<<< PONG`);
                    return;
                }
                this._debug(`<<< ${data}`);
                // Handle STOMP frames received from the server
                // The unmarshall function returns the frames parsed and any remaining
                // data from partial frames.
                const unmarshalledData = Frame.unmarshall(this.partialData + data);
                this.partialData = unmarshalledData.partial;
                unmarshalledData.frames.forEach((frame: Frame) => {
                    switch (frame.command) {
                        // [CONNECTED Frame](http://stomp.github.com/stomp-specification-1.1.html#CONNECTED_Frame)
                        case 'CONNECTED':
                            this._debug(`connected to server ${frame.headers.server}`);
                            this.connected = true;
                            this.version = frame.headers.version;
                            this._setupHeartbeat(this.ws, frame.headers);
                            observer.next(null)
                            break;
                        // [MESSAGE Frame](http://stomp.github.com/stomp-specification-1.1.html#MESSAGE)
                        case 'MESSAGE':
                            // the 'onreceive' callback is registered when the client calls
                            // 'subscribe()'.
                            // If there is registered subscription for the received message,
                            // we used the default 'onreceive' method that the client can set.
                            // This is useful for subscriptions that are automatically created
                            // on the browser side (e.g. [RabbitMQ's temporary
                            // queues](http://www.rabbitmq.com/stomp.html)).
                            const subscription: string = frame.headers.subscription;

                            const onreceive: Function = this.onMessageReceived && this.onMessageReceived(subscription);
                            if (onreceive) {
                                // 1.2 define ack header if ack is set to client
                                // and this header must be used for ack/nack
                                const messageID: string = this.version === VERSIONS.V1_2 &&
                                    frame.headers.ack ||
                                    frame.headers['message-id'];
                                // add 'ack()' and 'nack()' methods directly to the returned frame
                                // so that a simple call to 'message.ack()' can acknowledge the message.
                                frame.ack = this.ack.bind(this, messageID, subscription);
                                frame.nack = this.nack.bind(this, messageID, subscription);
                                onreceive(frame);
                            } else {
                                this._debug(`Unhandled received MESSAGE: ${frame}`);
                            }

                            break;
                        // [RECEIPT Frame](http://stomp.github.com/stomp-specification-1.1.html#RECEIPT)
                        //
                        // The client instance can set its 'onreceipt' field to a function taking
                        // a frame argument that will be called when a receipt is received from
                        // the server:
                        //
                        //     client.onreceipt = function(frame) {
                        //       receiptID = frame.headers['receipt-id'];
                        //       ...
                        //     }
                        case 'RECEIPT':
                            if (this.onMessageReceipted) this.onMessageReceipted()(frame);
                            break;
                        // [ERROR Frame](http://stomp.github.com/stomp-specification-1.1.html#ERROR)
                        case 'ERROR':
                            if(this.onErrorReceived) this.onErrorReceived()(frame)
                            break;
                        default:
                            this._debug(`Unhandled frame: ${frame}`);
                    }
                });
            };
            this.ws.onclose = (ev: any) => {
                this._debug(`Whoops! Lost connection to ${this.ws.url}:`, ev);
                this.onConnectionError && this.onConnectionError()(ev);
                onDisconnect (ev);
            };
            this.ws.onopen = () => {
                this._debug('Web Socket Opened...');
                headers['accept-version'] = VERSIONS.supportedVersions();
                // Check if we already have heart-beat in headers before adding them
                if (!headers['heart-beat']) {
                    headers['heart-beat'] = [this.heartbeat.outgoing, this.heartbeat.incoming].join(',');
                }
                this._transmit('CONNECT', headers);
            };

            return () => {
                this.disconnect(headers)
            }

        })

    }

    // Heart-beat negotiation
    private _setupHeartbeat = (ws: IWebSocket, headers: any) => {
        if (this.version !== VERSIONS.V1_1 && this.version !== VERSIONS.V1_2) return;

        // heart-beat header received from the server looks like:
        //
        //     heart-beat: sx, sy
        const [serverOutgoing, serverIncoming] = (headers['heart-beat'] || '0,0').split(',').map((v: string) => parseInt(v, 10));

        if (!(this.heartbeat.outgoing === 0 || serverIncoming === 0)) {
            let ttl = Math.max(this.heartbeat.outgoing, serverIncoming);
            this._debug(`send PING every ${ttl}ms`);
            this.pinger = setInterval(() => {
                this._wsSend(ws, BYTES.LF);
                this._debug('>>> PING');
            }, ttl);
        }

        if (!(this.heartbeat.incoming === 0 || serverOutgoing === 0)) {
            let ttl = Math.max(this.heartbeat.incoming, serverOutgoing);
            this._debug(`check PONG every ${ttl}ms`);
            this.ponger = setInterval(() => {
                let delta = Date.now() - this.serverActivity;
                // We wait twice the TTL to be flexible on window's setInterval calls
                if (delta > ttl * 2) {
                    this._debug(`did not receive server activity for the last ${delta}ms`);
                    ws.close();
                }
            }, ttl);
        }
    }

    // [DISCONNECT Frame](http://stomp.github.com/stomp-specification-1.1.html#DISCONNECT)
    public disconnect = (headers: any = {}) => {
        clearInterval(this.pinger);
        clearInterval(this.ponger);
        this.connected = false;
        if (this.ws) {
            this.ws.onclose = null;
            this._transmit('DISCONNECT', headers);
            this.ws.close();
            this.ws = null;
        }
    }

    // [SEND Frame](http://stomp.github.com/stomp-specification-1.1.html#SEND)
    //
    // * 'destination' is MANDATORY.
    public send = (headers: any = {}, body: any = '') => {
        this._transmit('SEND', headers, body);
    }

    // [BEGIN Frame](http://stomp.github.com/stomp-specification-1.1.html#BEGIN)
    //
    // If no transaction ID is passed, one will be created automatically
    public begin = (transaction: any = `tx-${this.counter++}`) => {
        this._transmit('BEGIN', {transaction});
        return {
            id: transaction,
            commit: this.commit.bind(this, transaction),
            abort: this.abort.bind(this, transaction)
        };
    }

    // [COMMIT Frame](http://stomp.github.com/stomp-specification-1.1.html#COMMIT)
    //
    // * 'transaction' is MANDATORY.
    //
    // It is preferable to commit a transaction by calling 'commit()' directly on
    // the object returned by 'client.begin()':
    //
    //     var tx = client.begin(txid);
    //     ...
    //     tx.commit();
    public commit = (transaction: any) => {
        this._transmit('COMMIT', {transaction});
    }

    // [ABORT Frame](http://stomp.github.com/stomp-specification-1.1.html#ABORT)
    //
    // * 'transaction' is MANDATORY.
    //
    // It is preferable to abort a transaction by calling 'abort()' directly on
    // the object returned by 'client.begin()':
    //
    //     var tx = client.begin(txid);
    //     ...
    //     tx.abort();
    public abort = (transaction: any) => {
        this._transmit('ABORT', {transaction});
    }

    // [ACK Frame](http://stomp.github.com/stomp-specification-1.1.html#ACK)
    //
    // * 'messageID' & 'subscription' are MANDATORY.
    //
    // It is preferable to acknowledge a message by calling 'ack()' directly
    // on the message handled by a subscription callback:
    //
    //     client.subscribe(destination,
    //       function(message) {
    //         // process the message
    //         // acknowledge it
    //         message.ack();
    //       },
    //       {'ack': 'client'}
    //     );
    public ack = (messageID: string, subscription: string, headers: any = {}) => {
        // 1.2 change id header name from message-id to id
        var idAttr = this.version === VERSIONS.V1_2 ? 'id' : 'message-id';
        headers[idAttr] = messageID;
        headers.subscription = subscription;
        this._transmit('ACK', headers);
    }

    // [NACK Frame](http://stomp.github.com/stomp-specification-1.1.html#NACK)
    //
    // * 'messageID' & 'subscription' are MANDATORY.
    //
    // It is preferable to nack a message by calling 'nack()' directly on the
    // message handled by a subscription callback:
    //
    //     client.subscribe(destination,
    //       function(message) {
    //         // process the message
    //         // an error occurs, nack it
    //         message.nack();
    //       },
    //       {'ack': 'client'}
    //     );
    public nack = (messageID: string, subscription: string, headers: any = {}) => {
        // 1.2 change id header name from message-id to id
        var idAttr = this.version === VERSIONS.V1_2 ? 'id' : 'message-id';
        headers[idAttr] = messageID;
        headers.subscription = subscription;
        this._transmit('NACK', headers);
    }

    // [SUBSCRIBE Frame](http://stomp.github.com/stomp-specification-1.1.html#SUBSCRIBE)
    public subscribe = ( headers: any = {}) => {
        this._transmit('SUBSCRIBE', headers);
        return {
            id: headers.id,
            unsubscribe: this.unSubscribe.bind(this, headers.id)
        };
    }

    // [UNSUBSCRIBE Frame](http://stomp.github.com/stomp-specification-1.1.html#UNSUBSCRIBE)
    //
    // * 'id' is MANDATORY.
    //
    // It is preferable to unsubscribe from a subscription by calling
    // 'unsubscribe()' directly on the object returned by 'client.subscribe()':
    //
    //     var subscription = client.subscribe(destination, onmessage);
    //     ...
    //     subscription.unsubscribe(headers);
    public unSubscribe = (headers: any = {}) => {
        this._transmit('UNSUBSCRIBE', headers);
    }

    // Base method to transmit any stomp frame
    private _transmit = (command: string, headers?: any, body?: any) => {
        if (!this.ws) {
            throw 'Error, this.ws is null ! Possibly initConnection has not been called or not subscribed !';
        }
        let out = Frame.marshall(command, headers, body);
        this._debug(`>>> ${out}`);
        this._wsSend(this.ws, out);
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

    // //// Debugging
    //
    // By default, debug messages are logged in the window's console if it is defined.
    // This method is called for every actual transmission of the STOMP frames over the
    // IWebSocket.
    //
    // It is possible to set a 'this._debug(message)' method
    // on a client instance to handle differently the debug messages:
    //
    //     client.debug = function(str) {
    //         // append the debug log to a #debug div
    //         $("#debug").append(str + "\n");
    //     };
    private _debug = (message: any, ...args: any[]) => {
        if (this.hasDebug) console.log(message, ...args);
    }

}

export default WebSocketHandler;

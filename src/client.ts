import {ConnectedClient, ConnectionHeaders} from './connectedClient';
import WebSocketHandler from './webSocketHandler';
import { Observer } from 'rxjs/Observer';
import { Observable } from 'rxjs/Observable';
import { ConnectableObservable } from 'rxjs/Observable/ConnectableObservable';
import { ReplaySubject } from 'rxjs/ReplaySubject';
import { WsOptions } from './webSocketHandler';
import 'rxjs/add/operator/multicast';

export interface IWebSocket {
    binaryType: string,
    onmessage: Function,
    onclose: Function,
    onopen: Function,
    close: Function,
    send: Function,
    url: string
}

export interface ClientOptions extends WsOptions {
    maxConnectAttempt: number,
    ttlConnectAttempt: number
}

const DEFAULT_MAX_CONNECT_ATTEMPT: number = 10
const DEFAULT_TTL_CONNECT_ATTEMPT: number = 1000

// STOMP Client Class
//
// All STOMP protocol is exposed as methods of this class ('connect()',
// 'send()', etc.)
class Client {

    private wsHandler: WebSocketHandler
    private observableConnection: Observable<ConnectedClient>
    private nbConnectAttempt: number
    private connectTimeout: any
    private maxConnectAttempt: number
    private ttlConnectAttempt: number


    constructor (createWsConnection: () => IWebSocket, options: ClientOptions) {
        console.log('BUILD')
        this.wsHandler = new WebSocketHandler(createWsConnection, options);
        this.nbConnectAttempt = 0;
        this.maxConnectAttempt = options.maxConnectAttempt || DEFAULT_MAX_CONNECT_ATTEMPT;
        this.ttlConnectAttempt =  options.ttlConnectAttempt || DEFAULT_TTL_CONNECT_ATTEMPT;
    }

    // [CONNECT Frame](http://stomp.github.com/stomp-specification-1.1.html#CONNECT_or_STOMP_Frame)
    //
    // The 'connect' method accepts different number of arguments and types:
    //
    // * 'connect(headers)'
    // * 'connect(headers)'
    // * 'connect(headers, onReceiveCallback)'
    // * 'connect(headers, onReceiveCallback, onReceiptCallback)'
    //
    // The onReceiveCallback and onReceiptCallback are optional
    // Return an Observable containing the connectedClient
    public connect = (headers: ConnectionHeaders): Observable<ConnectedClient> => {

        // create one and only one dedicated observable per destination
        if (!this.observableConnection) {
            const multicastConnection: ConnectableObservable<ConnectedClient> = this.__connect(headers)
                                                                                    .multicast(() => new ReplaySubject(1));
            multicastConnection.connect();
            this.observableConnection = multicastConnection.refCount();
        }
        return this.observableConnection;

    }

    private __connect = (headers: ConnectionHeaders): Observable<ConnectedClient> => {

        return Observable.create(
            (observer: Observer<ConnectedClient>) => {
                // we initialize only once the connection
                this.__initConnectedClient( headers, observer)
                // when unsubscribe, we disconnect the websocket
                return () => {
                    this.wsHandler.disconnect(headers);
                }
            })

    }

    private __initConnectedClient = (headers: any,
                          currentObserver: Observer<ConnectedClient>) => {

        let connectedClient: ConnectedClient = new ConnectedClient(this.wsHandler);

        // we initialize the connection
        this.wsHandler.initConnection(headers,
            (ev: any) => {
                if (this.nbConnectAttempt < this.maxConnectAttempt) {
                    this.nbConnectAttempt ++;
                    clearTimeout(this.connectTimeout)
                    this.connectTimeout = setTimeout (
                        // when unexpected disconnection happens, we reconnect
                        () => this.__initConnectedClient(headers,
                            currentObserver),
                        this.nbConnectAttempt * this.ttlConnectAttempt
                    )
                } else {
                    currentObserver.error('Attempted to connect ' + this.nbConnectAttempt + ' failed.');
                }
            }
        ).subscribe(() => {
            clearTimeout(this.connectTimeout)
            this.nbConnectAttempt = 0;
            currentObserver.next(connectedClient);
        });

    }

}

export default Client;

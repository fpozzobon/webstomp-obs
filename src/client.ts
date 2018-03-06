import { Observer } from 'rxjs/Observer';
import { Observable } from 'rxjs/Observable';
import { ConnectableObservable } from 'rxjs/Observable/ConnectableObservable';
import { ReplaySubject } from 'rxjs/ReplaySubject';

import 'rxjs/add/observable/timer';
import 'rxjs/add/observable/of';
import 'rxjs/add/observable/throw';
import 'rxjs/add/operator/multicast';
import 'rxjs/add/operator/retryWhen';
import 'rxjs/add/operator/scan';
import 'rxjs/add/operator/do';
import 'rxjs/add/operator/catch';

import createConnectedClient from './connectedClient'
import { ConnectedClient } from './connectedClient';
import { ConnectionHeaders } from './headers';
import WebSocketHandler from './webSocketHandler';
import stompWebSocketHandler from './protocol/stomp/stompWebSocketHandler';
import { IWebSocketHandler, IConnectedObservable, WsOptions, IWebSocket } from './types';

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

    private stompWebSockerHandler: IWebSocketHandler<IConnectedObservable>
    private observableConnection: Observable<ConnectedClient>
    private maxConnectAttempt: number
    private ttlConnectAttempt: number
    private isConnected: boolean

    constructor (createWsConnection: () => IWebSocket, options: ClientOptions) {
        this.stompWebSockerHandler = stompWebSocketHandler(createWsConnection, options);
        this.maxConnectAttempt = options.maxConnectAttempt || DEFAULT_MAX_CONNECT_ATTEMPT;
        this.ttlConnectAttempt =  options.ttlConnectAttempt || DEFAULT_TTL_CONNECT_ATTEMPT;
        this.isConnected = false;
    }

    // [CONNECT Frame](http://stomp.github.com/stomp-specification-1.1.html#CONNECT_or_STOMP_Frame)
    //
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
        return this.__initConnectedClient(headers).map((connection: IConnectedObservable) => {
            this.isConnected = true;
            return createConnectedClient(connection);
        })
    }

    private __initConnectedClient = (headers: ConnectionHeaders) => {

        // we initialize the connection
        return this.stompWebSockerHandler.initConnection(headers)
                .retryWhen(attemps => attemps.scan( (errorCount, err) => {
                        // we reinitialize the error count if we were previously connected
                        if (this.isConnected) {
                            this.isConnected = false;
                            errorCount = 0;
                        }
                        if (this.maxConnectAttempt !== -1 && errorCount >= this.maxConnectAttempt) {
                            throw 'Attempted to connect ' + errorCount + ' failed.';
                        }
                        return errorCount + 1;
                    }, 1)
                    .do( errorCount => Observable.timer(errorCount * this.ttlConnectAttempt))
                );

    }

}

export default Client;

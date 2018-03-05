import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';

import Frame from './frame';
import { ACK, AckHeaders, NackHeaders,
         ConnectionHeaders, DisconnectHeaders, SubscribeHeaders, UnsubscribeHeaders } from './headers';
import { HeartbeatOptions } from './observableHeartbeat';

export interface IWebSocketHandler<T> {
  initConnection: (headers: ConnectionHeaders) => Observable<T>;
}

export interface IEvent {
    data: any;
}

export interface IWebSocketObservable {
   messageReceived: Observable<IEvent>;
   messageSender: Subject<any>;
}

export interface IProtocol {
    getMessageId: (frame: Frame) => string,
    getSubscription: (frame: Frame) => string,
    connect: (headers: ConnectionHeaders) => any,
    disconnect: (headers: DisconnectHeaders) => any,
    send: (headers: any, body: any) => any;
    begin: (transaction: any) => any;
    commit: (transaction: string) => any;
    abort: (transaction: string) => any;
    ack: (messageID: string, subscription: string, headers?: AckHeaders) => any;
    nack?: (messageID: string, subscription: string, headers?: NackHeaders) => any;
    subscribe: (headers: SubscribeHeaders) => any;
    unSubscribe: (headers: UnsubscribeHeaders) => any;
    hearbeatMsg?: () => any;
}

export interface IConnectedObservable {
    messageReceipted: Observable<Frame>;
    errorReceived: Observable<Frame>;
    subscribeTo: (destination: string, headers: {id?: string, ack?: ACK}) => Observable<Frame>;
    messageSender: Subject<any>;
    protocol: IProtocol;
}

export interface WsOptions {
    binary: boolean;
    heartbeat: HeartbeatOptions | boolean;
    debug: boolean;
}

export interface IWebSocket {
    binaryType: string,
    onmessage: Function,
    onclose: Function,
    onopen: Function,
    close: Function,
    send: Function,
    url: string
}

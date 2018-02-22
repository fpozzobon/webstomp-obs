import Frame from './frame';
import { AckHeaders, NackHeaders,
         ConnectedHeaders, ConnectionHeaders, DisconnectHeaders,
         SubscribeHeaders, UnsubscribeHeaders } from './headers';

export interface IEvent {
    data: any;
}

export interface IProtocolHandler {
    parseMessageReceived: (evt: IEvent) => Frame[];
    connect: (headers: ConnectionHeaders) => any;
    disconnect: (headers: DisconnectHeaders) => any;
    send: (headers: any, body: any) => any;
    begin: (transaction: any) => any;
    commit: (transaction: string) => any;
    abort: (transaction: string) => any;
    ack: (messageID: string, subscription: string, headers?: AckHeaders) => any;
    nack: (messageID: string, subscription: string, headers?: NackHeaders) => any;
    subscribe: (headers: SubscribeHeaders) => any;
    unSubscribe: (headers: UnsubscribeHeaders) => any;
    handleFrame: (onConnected: (headers: ConnectedHeaders) => void,
                  onReceived: (frame: Frame, messageID: string, subscription: string) => void,
                  onReceipt: (frame: Frame) => void,
                  onError: (frame: Frame) => void) => (frame: Frame) => void;
}

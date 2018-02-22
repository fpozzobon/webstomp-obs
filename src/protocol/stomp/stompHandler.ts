import { IEvent, IProtocolHandler } from '../../types';
import Frame from '../../frame';
import { AckHeaders, NackHeaders,
         ConnectedHeaders, ConnectionHeaders, DisconnectHeaders,
         SubscribeHeaders, UnsubscribeHeaders } from '../../headers';
import { VERSIONS, BYTES, typedArrayToUnicodeString } from '../../utils';


// STOMP Handler Class
//
// All STOMP protocol is exposed as methods of this class ('connect()',
// 'send()', etc.)
const stompHandler = (debug: (msg: any) => void): IProtocolHandler => {

    let partialData: string = '';
    let version: string = '';
    let counter = 0;

    const parseMessageReceived = (evt: IEvent): Frame[] => {
        let data = evt.data;
        if (evt.data instanceof ArrayBuffer) {
            data = typedArrayToUnicodeString(new Uint8Array(evt.data))
        }

        // heartbeat
        if (data === BYTES.LF) {
            debug(`<<< PONG`);
            return;
        }
        debug(`<<< ${data}`);
        // Handle STOMP frames received from the server
        // The unmarshall function returns the frames parsed and any remaining
        // data from partial frames are buffered.
        const unmarshalledData = Frame.unmarshall(partialData + data);
        partialData = unmarshalledData.partial;

        return unmarshalledData.frames;
    }


    const handleFrame = (onConnected: (headers: ConnectedHeaders) => void,
                         onReceived: (frame: Frame, messageID: string, subscription: string) => void,
                         onReceipt: (frame: Frame) => void,
                         onError: (frame: Frame) => void) => {
        return (frame: Frame): void => {
            switch (frame.command) {
                // [CONNECTED Frame](http://stomp.github.com/stomp-specification-1.1.html#CONNECTED_Frame)
                case 'CONNECTED':
                    version = frame.headers.version;
                    onConnected(frame.headers);
                    break;
                // [MESSAGE Frame](http://stomp.github.com/stomp-specification-1.1.html#MESSAGE)
                case 'MESSAGE':
                    // 1.2 define ack header if ack is set to client
                    // and this header must be used for ack/nack
                    const subscription: string = frame.headers.subscription
                    const messageID: string = version === VERSIONS.V1_2 &&
                        frame.headers.ack ||
                        frame.headers['message-id'];
                    onReceived(frame, messageID, subscription);
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
                    onReceipt(frame);
                    break;
                // [ERROR Frame](http://stomp.github.com/stomp-specification-1.1.html#ERROR)
                case 'ERROR':
                    onError(frame);
                    break;
                default:
                    debug(`Unhandled frame: ${frame}`);
            }
        }
    }

    const connect = (headers: ConnectionHeaders): any => {
        headers['accept-version'] = VERSIONS.supportedVersions();
        return Frame.marshall('CONNECT', headers as any);
    }

    // [DISCONNECT Frame](http://stomp.github.com/stomp-specification-1.1.html#DISCONNECT)
    const disconnect = (headers: DisconnectHeaders = {}): any => {
        return Frame.marshall('DISCONNECT', headers as any);
    }

    // [SEND Frame](http://stomp.github.com/stomp-specification-1.1.html#SEND)
    //
    // * 'destination' is MANDATORY.
    const send = (headers: any = {}, body: any = ''): any => {
        return Frame.marshall('SEND', headers, body);
    }

    // [BEGIN Frame](http://stomp.github.com/stomp-specification-1.1.html#BEGIN)
    //
    // If no transaction ID is passed, one will be created automatically
    const begin = (transaction: any = `tx-${counter++}`): any => {
        return Frame.marshall('BEGIN', {transaction} as any);
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
    const commit = (transaction: string): any => {
        return Frame.marshall('COMMIT', {transaction} as any);
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
    const abort = (transaction: string): any => {
        return Frame.marshall('ABORT', {transaction} as any);
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
    const ack = (messageID: string, subscription: string, headers?: AckHeaders): any => {
        const currentHeader: any = {...headers}
        currentHeader[_getIdAttr()] = messageID;
        currentHeader.subscription = subscription;
        return Frame.marshall('ACK', currentHeader);
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
    const nack = (messageID: string, subscription: string, headers?: NackHeaders): any => {
        const currentHeader: any = {...headers}
        currentHeader[_getIdAttr()] = messageID;
        currentHeader.subscription = subscription;
        return Frame.marshall('NACK', currentHeader);
    }

    const _getIdAttr = (): string => {
        return version === VERSIONS.V1_2 ? 'id' : 'message-id';
    }

    // [SUBSCRIBE Frame](http://stomp.github.com/stomp-specification-1.1.html#SUBSCRIBE)
    const subscribe = (headers: SubscribeHeaders): any => {
        return Frame.marshall('SUBSCRIBE', headers as any);
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
    const unSubscribe = (headers: UnsubscribeHeaders): any => {
        return Frame.marshall('UNSUBSCRIBE', headers as any);
    }

    return {parseMessageReceived, handleFrame, connect, disconnect, send, begin, commit, abort, ack, nack, subscribe, unSubscribe};

}

export default stompHandler

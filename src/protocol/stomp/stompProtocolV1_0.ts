import Frame from '../../frame';
import { AckHeaders, ConnectionHeaders, DisconnectHeaders, SubscribeHeaders, UnsubscribeHeaders } from '../../headers';
import { BYTES } from '../../utils';
import { IProtocol } from '../../types';


// STOMP protocol with the V1_0
const stompProtocolV1_0 = (): IProtocol => {

    let counter = 0;

    const getMessageId = (frame: Frame): string =>
            frame.headers['message-id']

    const getSubscription = (frame: Frame): string =>
            frame.headers.subscription

    // [CONNECTED Frame](http://stomp.github.com/stomp-specification-1.1.html#CONNECTED_Frame)
    const connect = (headers: ConnectionHeaders): any =>
            Frame.marshall('CONNECT', headers as any)

    // [DISCONNECT Frame](http://stomp.github.com/stomp-specification-1.1.html#DISCONNECT)
    const disconnect = (headers: DisconnectHeaders = {}): any =>
            Frame.marshall('DISCONNECT')

    // [SEND Frame](http://stomp.github.com/stomp-specification-1.1.html#SEND)
    //
    // * 'destination' is MANDATORY.
    const send = (headers: any = {}, body: any = ''): any =>
            Frame.marshall('SEND', headers, body)

    // [BEGIN Frame](http://stomp.github.com/stomp-specification-1.1.html#BEGIN)
    //
    // If no transaction ID is passed, one will be created automatically
    const begin = (transaction: any = `tx-${counter++}`): any =>
            Frame.marshall('BEGIN', {transaction} as any)

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
    const commit = (transaction: string): any =>
            Frame.marshall('COMMIT', {transaction} as any)

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
    const abort = (transaction: string): any =>
            Frame.marshall('ABORT', {transaction} as any)

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
    const ack = (messageID: string, subscription: string, headers?: AckHeaders): any =>
            Frame.marshall('ACK', {...headers, 'message-id': messageID, subscription})

    // [SUBSCRIBE Frame](http://stomp.github.com/stomp-specification-1.1.html#SUBSCRIBE)
    const subscribe = (headers: SubscribeHeaders): any =>
            Frame.marshall('SUBSCRIBE', headers as any)

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
    const unSubscribe = (headers: UnsubscribeHeaders): any =>
            Frame.marshall('UNSUBSCRIBE', headers as any)

    return {getMessageId, getSubscription, connect, disconnect, send, begin, commit, abort, ack, subscribe, unSubscribe}

}

export default stompProtocolV1_0

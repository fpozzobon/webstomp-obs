import { BYTES } from '../../utils';
import { IProtocol } from '../../types';
import Frame from '../../frame';
import { NackHeaders } from '../../headers';
import stompProtocolV1_0 from './stompProtocolV1_0'


// STOMP protocol with the version V1_1
const stompProtocolV1_1 = (): IProtocol => {

    const currentProtocol = stompProtocolV1_0();

    const hearbeatMsg = (): any => BYTES.LF

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
    const nack = (messageID: string, subscription: string, headers?: NackHeaders): any =>
            Frame.marshall('NACK', {...headers, 'message-id': messageID, subscription})

    return {...currentProtocol, hearbeatMsg, nack}

}

export default stompProtocolV1_1

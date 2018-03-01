import Frame from '../../frame';
import { IProtocol } from '../../types';
import stompProtocolV1_1 from './stompProtocolV1_1'
import { AckHeaders, NackHeaders } from '../../headers';


// STOMP protocol with the version V1_2
const stompProtocolV1_2 = (): IProtocol => {

    const currentProtocol: IProtocol = stompProtocolV1_1();

    const getMessageId = (frame: Frame): string => {
        return frame.headers.ack || currentProtocol.getMessageId(frame);
    }

    const ack = (messageID: string, subscription: string, headers?: AckHeaders): any => {
        const currentHeader: any = {...headers}
        currentHeader['id'] = messageID;
        currentHeader.subscription = subscription;
        return Frame.marshall('ACK', currentHeader);
    }

    const nack = (messageID: string, subscription: string, headers?: NackHeaders): any => {
        const currentHeader: any = {...headers}
        currentHeader['id'] = messageID;
        currentHeader.subscription = subscription;
        return Frame.marshall('NACK', currentHeader);
    }

    return {...currentProtocol, ack, nack, getMessageId};

}

export default stompProtocolV1_2

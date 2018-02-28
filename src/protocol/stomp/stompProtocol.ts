import Frame from '../../frame';
import { AckHeaders, NackHeaders,
         ConnectionHeaders, DisconnectHeaders, SubscribeHeaders, UnsubscribeHeaders } from '../../headers';
import { VERSIONS, BYTES } from '../../utils';
import { IProtocol } from '../../types';
import stompProtocolV1_0 from './stompProtocolV1_0'
import stompProtocolV1_1 from './stompProtocolV1_1'
import stompProtocolV1_2 from './stompProtocolV1_2'


// STOMP protocol with the version in parameter
const stompProtocol = (version?: string): IProtocol => {

    let currentProtocol: IProtocol;

    if (version === VERSIONS.V1_2) {
        currentProtocol = stompProtocolV1_2();
    } else if (version === VERSIONS.V1_1) {
        currentProtocol = stompProtocolV1_1();
    } else {
        currentProtocol = stompProtocolV1_0();
    }

    // [CONNECTED Frame](http://stomp.github.com/stomp-specification-1.1.html#CONNECTED_Frame)
    const connect = (headers: ConnectionHeaders): any => {
        headers['accept-version'] = VERSIONS.supportedVersions();
        return currentProtocol.connect(headers);
    }

    return {...currentProtocol, connect};

}

export default stompProtocol

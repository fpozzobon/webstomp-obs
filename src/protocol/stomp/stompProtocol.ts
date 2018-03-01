import Frame from '../../frame';
import { AckHeaders, NackHeaders,
         ConnectionHeaders, DisconnectHeaders, SubscribeHeaders, UnsubscribeHeaders } from '../../headers';
import { BYTES } from '../../utils';
import { IProtocol } from '../../types';
import stompProtocolV1_0 from './stompProtocolV1_0'
import stompProtocolV1_1 from './stompProtocolV1_1'
import stompProtocolV1_2 from './stompProtocolV1_2'

export const VERSIONS = {
    V1_0: '1.0',
    V1_1: '1.1',
    V1_2: '1.2',
    // Versions of STOMP specifications supported
    supportedVersions: () => '1.2,1.1,1.0',
    supportedProtocols: () => ['v10.stomp', 'v11.stomp', 'v12.stomp']
};

// STOMP protocol with the version in parameter
const stompProtocol = (version: string = VERSIONS.V1_0): IProtocol => {

    let currentProtocol: IProtocol;

    switch(version) {
        case VERSIONS.V1_2: {
           currentProtocol = stompProtocolV1_2();
           break;
        }
        case VERSIONS.V1_1: {
           currentProtocol = stompProtocolV1_1();
           break;
        }
        case VERSIONS.V1_0: {
           currentProtocol = stompProtocolV1_0();
           break;
        }
        default: {
            throw `Unsupported version : ${version} ! Versions supported are : ${VERSIONS.supportedVersions()}`
        }
    }

    // [CONNECTED Frame](http://stomp.github.com/stomp-specification-1.1.html#CONNECTED_Frame)
    const connect = (headers: ConnectionHeaders): any =>
            currentProtocol.connect({...headers, 'accept-version': VERSIONS.supportedVersions()})

    return {...currentProtocol, connect};

}

export default stompProtocol

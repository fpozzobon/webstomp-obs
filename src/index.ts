import Client from './client';
import { VERSIONS, logger } from './utils';
import { IWebSocket, ClientOptions } from './client';

// The `webstomp` Object
const stompobservable = {
    VERSIONS,
    // This method creates a WebSocket client that is connected to
    // the STOMP server located at the url.
    client: function(url: string, options: ClientOptions = {} as ClientOptions, protocols: string[] = VERSIONS.supportedProtocols()) {
        setupLogger(options);
        let createWsConnection: () => IWebSocket = () => { return new WebSocket(url, protocols) as IWebSocket };
        return new Client(createWsConnection, options);
    },
    // This method is an alternative to `webstomp.client()` to let the user
    // specify the WebSocket to use via the function createWsConnection
    // (returning either a standard HTML5 WebSocket or a similar object).
    over: (createWsConnection: () => IWebSocket, options: ClientOptions = {} as ClientOptions) => {
        setupLogger(options);
        return new Client(createWsConnection, options);
    }
};

const setupLogger = (options: ClientOptions) => {
  let {debug = false} = options;
  logger.setDebug(!!debug);
}

export default stompobservable;

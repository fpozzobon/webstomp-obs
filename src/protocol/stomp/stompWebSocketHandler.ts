import { Observable } from 'rxjs/Observable';
import { Observer } from 'rxjs/Observer';
import { Subject } from 'rxjs/Subject';

import 'rxjs/add/operator/switchMap';
import 'rxjs/add/operator/filter';
import 'rxjs/add/operator/concatMap';
import 'rxjs/add/operator/map';
import 'rxjs/add/observable/merge';

import { IEvent, IProtocol, IConnectedObservable, IWebSocketObservable, IWebSocketHandler, WsOptions, IWebSocket } from '../../types';
import Frame from '../../frame';
import { ACK, ConnectionHeaders, SubscribeHeaders, UnsubscribeHeaders } from '../../headers';
import { typedArrayToUnicodeString, logger, parseData } from '../../utils';
import WebSocketHandler from '../../webSocketHandler';
import stompProtocol from './stompProtocol';
import observableHeartbeat, {HeartbeatOptions} from '../../observableHeartbeat';

const parseHeartbeatSettings = (settings: HeartbeatOptions): string =>
    [settings.outgoing, settings.incoming].join(',')

const messageParser = () => {
    let partialData: string = '';

    const parseMessageReceived = (protocol: IProtocol) =>
        (evt: IEvent): Frame[] => {
            const unmarshalledData = parseData(evt.data,
                                               partialData,
                                               protocol.hearbeatMsg && protocol.hearbeatMsg())
            if(!unmarshalledData) {
                return []
            }
            partialData = unmarshalledData.partial
            return unmarshalledData.frames
        }

    return { parseMessageReceived }
}

const stompMessageObs = (wsConnection: IWebSocketObservable, protocol: IProtocol, parseMessage) => {
    let counter = 0;
    // subscribing to message received
    const frameObservable: Observable<Frame> = wsConnection.messageReceived
        .concatMap(parseMessage.parseMessageReceived(protocol))

    // receipt message flux
    const stompMessageReceipted: Observable<Frame> = frameObservable
        .filter((frame: Frame) => frame.command === 'RECEIPT')

    // errorReceived flux
    const errorReceived: Observable<Frame> = frameObservable
        .filter((frame: Frame) => frame.command === 'ERROR')

    // Subscribing to a destination
    const subscribeTo = (destination: string, _headers: {id?: string, ack?: ACK} = {}): Observable<Frame> => {
        const id = _headers.id || 'sub-' + counter++;
        const currentHeader: SubscribeHeaders = {destination, ack: _headers.ack, id };
        // sending subscribe to the server
        wsConnection.messageSender.next(protocol.subscribe(currentHeader));
        // subscribing to the messages from the subscription
        return frameObservable.filter((frame: Frame) => frame.command === 'MESSAGE')
                .filter((frame: Frame) => frame.headers.subscription === id)
                .map((frame: Frame) => {
                    const subscription: string = protocol.getSubscription(frame)
                    const messageID: string = protocol.getMessageId(frame);
                    frame.ack = () => wsConnection.messageSender.next(protocol.ack(messageID, subscription));
                    protocol.nack && (frame.nack = () => wsConnection.messageSender.next(protocol.nack(messageID, subscription)));
                    return frame
                }).finally(() => wsConnection.messageSender.next(protocol.unSubscribe({id})))
    }

    return Observable.create((stompWebSocketObserver: Observer<IConnectedObservable>) => {
        stompWebSocketObserver.next({ subscribeTo: subscribeTo,
                messageReceipted: stompMessageReceipted,
                errorReceived: errorReceived,
                messageSender: wsConnection.messageSender,
                protocol: protocol })
        return () => wsConnection.messageSender.next(protocol.disconnect({receipt: `${counter++}`}))
    })
}

// STOMP Handler Class
//
// Using stompProtocol
//
const stompWebSocketHandler = (createWsConnection: () => IWebSocket, options: WsOptions): IWebSocketHandler<IConnectedObservable> => {

    const wsHandler: WebSocketHandler = new WebSocketHandler(createWsConnection, options);

    let heartbeatClientSettings: HeartbeatOptions = ((typeof options.heartbeat === 'boolean') ?
        {outgoing: 0, incoming: 0} : options.heartbeat) || {outgoing: 10000, incoming: 10000}

    const initConnection = (headers: ConnectionHeaders): Observable<IConnectedObservable> => {

        let currentHeaders: ConnectionHeaders = {...headers}
        // Check if we already have heart-beat in headers before adding them
        if (!headers['heart-beat']) {
            currentHeaders['heart-beat'] = parseHeartbeatSettings(heartbeatClientSettings);
        }

        return wsHandler.initConnection(currentHeaders).switchMap((wsConnection: IWebSocketObservable) => {

            let counter: number = 0;
            let currentProtocol: IProtocol = stompProtocol(); // we initialise the current protocol with no version as we need it for CONNECT

            const parseMessage = messageParser();

            // sending connect message to the server
            wsConnection.messageSender.next(currentProtocol.connect(currentHeaders));

            // listen to the messages received from the connection
            // to send a bit every n ms and check that we get a message every n ms
            const heartbeatObserver = (mappedFrame) => {
                const {frame, protocol} = mappedFrame
                // we start heartbeat only if the protocol support it
                const hearbeatMsg = protocol.hearbeatMsg();
                if (hearbeatMsg) {
                    const [outgoing, incoming] = (frame.headers['heart-beat'] || '0,0').split(',').map((v: string) => parseInt(v, 10));

                    const heartbeat = observableHeartbeat(heartbeatClientSettings,
                        {outgoing, incoming},
                        () => wsConnection.messageSender.next(hearbeatMsg))
                    return wsConnection.messageReceived.pipe(heartbeat).filter(() => false)
                } else {
                    return Observable.empty()
                }
            }

            return wsConnection.messageReceived.concatMap(parseMessage.parseMessageReceived(currentProtocol))
                .filter((frame) => frame.command === 'CONNECTED')
                .map((frame) => {return {frame: frame, protocol: stompProtocol(frame.headers.version)}})
                .switchMap((mappedFrame) => {
                    const {frame, protocol} = mappedFrame
                    logger.debug(`connected to server ${frame.headers.server}`);
                    // merging the heartbeat with the init connection
                    return Observable.merge(stompMessageObs(wsConnection, protocol, parseMessage), heartbeatObserver(mappedFrame))
                })

        })
    }

    return { initConnection };

}

export default stompWebSocketHandler

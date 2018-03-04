import { Observable } from 'rxjs/Observable';
import { Observer } from 'rxjs/Observer';
import { Subject } from 'rxjs/Subject';

import 'rxjs/add/operator/switchMap';
import 'rxjs/add/operator/filter';
import 'rxjs/add/operator/concatMap';
import 'rxjs/add/operator/map';

import { IEvent, IProtocol, IConnectedObservable, IWebSocketObservable, IWebSocketHandler, WsOptions, IWebSocket } from '../../types';
import Frame from '../../frame';
import { ACK, ConnectionHeaders, SubscribeHeaders, UnsubscribeHeaders } from '../../headers';
import { typedArrayToUnicodeString, logger, parseData } from '../../utils';
import WebSocketHandler from '../../webSocketHandler';
import stompProtocol from './stompProtocol';
import Heartbeat from '../../heartbeat';

const parseHeartbeatSettings = (heartbeat: Heartbeat): string =>
    [heartbeat.heartbeatSettings.outgoing, heartbeat.heartbeatSettings.incoming].join(',')

// STOMP Handler Class
//
// Using stompProtocol
//
const stompWebSocketHandler = (createWsConnection: () => IWebSocket, options: WsOptions): IWebSocketHandler<IConnectedObservable> => {

    const wsHandler: WebSocketHandler = new WebSocketHandler(createWsConnection, options);

    // creating the heartbeat
    const heartbeat = new Heartbeat(options.heartbeat);

    const initConnection = (headers: ConnectionHeaders): Observable<IConnectedObservable> => {

        let currentHeaders: ConnectionHeaders = {...headers}
        // Check if we already have heart-beat in headers before adding them
        if (!headers['heart-beat']) {
            currentHeaders['heart-beat'] = parseHeartbeatSettings(heartbeat);
        }

        return wsHandler.initConnection(currentHeaders).switchMap((wsConnection: IWebSocketObservable) => {

            let counter: number = 0;
            let partialData: string = '';
            let version: string = '';
            let currentProtocol: IProtocol = stompProtocol(); // we initialise the current protocol with no version as we need it for CONNECT

            // sending connect to the server
            wsConnection.messageSender.next(currentProtocol.connect(currentHeaders));

            const _parseMessageReceived = (evt: IEvent): Frame[] => {
                const unmarshalledData = parseData(evt.data,
                                                   partialData,
                                                   currentProtocol.hearbeatMsg && currentProtocol.hearbeatMsg());
                if(!unmarshalledData) {
                    return [];
                }
                partialData = unmarshalledData.partial;
                return unmarshalledData.frames;
            }

            const unSubscribe = (_headers: UnsubscribeHeaders) =>
                wsConnection.messageSender.next(currentProtocol.unSubscribe(_headers))

            const stompMessageReceived = new Subject()

            const subscribeTo = (destination: string, _headers: {id?: string, ack?: ACK} = {}): Observable<Frame> => {
                const id = _headers.id || 'sub-' + counter++;
                const currentHeader: SubscribeHeaders = {destination, ack: _headers.ack, id };
                wsConnection.messageSender.next(currentProtocol.subscribe(currentHeader));
                return <Observable<Frame>>stompMessageReceived.finally(() => unSubscribe({id})).filter(
                  (frame: Frame) => frame.headers.subscription === id
                );
            }

            // subscribing to message received
            const frameObservable = wsConnection.messageReceived
                .do(heartbeat.activityFromServer)
                .concatMap(_parseMessageReceived)

            const messageSub = frameObservable
                .filter((frame) => frame.command === 'MESSAGE')
                .subscribe((frame) => {
                    const subscription: string = currentProtocol.getSubscription(frame)
                    const messageID: string = currentProtocol.getMessageId(frame);
                    frame.ack = () => wsConnection.messageSender.next(currentProtocol.ack(messageID, subscription));
                    currentProtocol.nack && (frame.nack = () => wsConnection.messageSender.next(currentProtocol.nack(messageID, subscription)));
                    stompMessageReceived.next(frame)
                })

            const stompMessageReceipted = frameObservable
                .filter((frame) => frame.command === 'RECEIPT')

            const errorReceived = frameObservable
                .filter((frame) => frame.command === 'ERROR')

            return frameObservable.filter((frame) => frame.command === 'CONNECTED')
                .map((frame) => {return {frame: frame, protocol: stompProtocol(frame.headers.version)}})
                .do((mappedFrame) => {
                    const {frame, protocol} = mappedFrame
                    // we start heartbeat only if the protocol support it
                    const hearbeatMsg = protocol.hearbeatMsg();
                    if (hearbeatMsg) {
                        const [serverOutgoing, serverIncoming] = (frame.headers['heart-beat'] || '0,0').split(',').map((v: string) => parseInt(v, 10));
                        heartbeat.startHeartbeat(serverOutgoing,
                                                 serverIncoming,
                                                {
                                                    sendPing: () => wsConnection.messageSender.next(hearbeatMsg),
                                                    close: (error) => null//connectionObserver.error(error)
                                                });
                    }
                })
                .map((mappedFrame) => {
                    const {frame, protocol} = mappedFrame
                    currentProtocol = protocol;
                    logger.debug(`connected to server ${frame.headers.server}`);

                    return { subscribeTo: subscribeTo,
                            messageReceipted: stompMessageReceipted,
                            errorReceived: errorReceived,
                            messageSender: wsConnection.messageSender,
                            protocol: protocol }
                }).finally(() => {
                    heartbeat.stopHeartbeat();
                    wsConnection.messageSender.next(currentProtocol.disconnect({receipt: `${counter++}`}));
                    messageSub && messageSub.unsubscribe();
                    stompMessageReceived.complete();
                })

        })
    }

    return { initConnection };

}

export default stompWebSocketHandler

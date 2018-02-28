import { Observable } from 'rxjs/Observable';
import { Observer } from 'rxjs/Observer';
import { Subject } from 'rxjs/Subject';

import 'rxjs/add/operator/switchMap';
import 'rxjs/add/operator/filter';

import { IEvent, IProtocol, IConnectedObservable, IWebSocketObservable, IWebSocketHandler, WsOptions, IWebSocket } from '../../types';
import Frame from '../../frame';
import { ACK, ConnectionHeaders, SubscribeHeaders, UnsubscribeHeaders } from '../../headers';
import { typedArrayToUnicodeString, logger } from '../../utils';
import WebSocketHandler from '../../webSocketHandler';
import stompProtocol from './stompProtocol';
import Heartbeat from '../../heartbeat';


// STOMP Handler Class
//
// Using stompProtocol
//
const stompWebSocketHandler = (createWsConnection: () => IWebSocket, options: WsOptions): IWebSocketHandler<IConnectedObservable> => {

    const wsHandler: WebSocketHandler = new WebSocketHandler(createWsConnection, options);

    // creating the heartbeat
    const heartbeat = new Heartbeat(options.heartbeat);

    const initConnection = (headers: ConnectionHeaders): Observable<IConnectedObservable> => {

        let disconnectFn;

        return wsHandler.initConnection(headers).switchMap((wsConnection: IWebSocketObservable) => {

            // Check if we already have heart-beat in headers before adding them
            if (!headers['heart-beat']) {
                headers['heart-beat'] = [heartbeat.heartbeatSettings.outgoing, heartbeat.heartbeatSettings.incoming].join(',');
            }

            let counter: number = 0;
            let partialData: string = '';
            let version: string = '';
            let currentProtocol: IProtocol = stompProtocol(); // we initialise the current protocol with no version as we need it for CONNECT

            const _parseMessageReceived = (evt: IEvent): Frame[] => {
                let data = evt.data;
                if (evt.data instanceof ArrayBuffer) {
                    data = typedArrayToUnicodeString(new Uint8Array(evt.data))
                }

                // heartbeat
                if (currentProtocol.hearbeatMsg && data === currentProtocol.hearbeatMsg()) {
                    logger.debug(`<<< PONG`);
                    return;
                }
                logger.debug(`<<< ${data}`);
                // Handle STOMP frames received from the server
                // The unmarshall function returns the frames parsed and any remaining
                // data from partial frames are buffered.
                const unmarshalledData = Frame.unmarshall(partialData + data);
                partialData = unmarshalledData.partial;

                return unmarshalledData.frames;
            }

            const unSubscribe = (_headers: UnsubscribeHeaders) => {
                wsConnection.messageSender.next(currentProtocol.unSubscribe(_headers));
            }

            return Observable.create((connectionObserver: Observer<IConnectedObservable>) => {

                const stompMessageReceived = new Subject()
                const stompMessageReceipted = new Subject()
                const errorReceived = new Subject()

                const subscribeTo = (destination: string, _headers: {id?: string, ack?: ACK} = {}): Observable<Frame> => {
                    const id = _headers.id || 'sub-' + counter++;
                    const currentHeader: SubscribeHeaders = {destination, ack: _headers.ack, id };
                    wsConnection.messageSender.next(currentProtocol.subscribe(currentHeader));
                    return stompMessageReceived.finally(() => unSubscribe({id})).filter(
                      (frame: Frame) => frame.headers.subscription === id
                    );
                }

                // subscribing to message received
                const msgSubscription = wsConnection.messageReceived.subscribe((evt: IEvent) => {
                    heartbeat.activityFromServer();
                    const dataFrames = _parseMessageReceived(evt);
                    dataFrames && dataFrames.forEach(
                        (frame: Frame) => {
                            switch (frame.command) {
                                case 'CONNECTED':
                                    version = frame.headers.version;
                                    currentProtocol = stompProtocol(version);
                                    logger.debug(`connected to server ${frame.headers.server}`);

                                    // we start heartbeat only if the protocol support it
                                    const hearbeatMsg = currentProtocol.hearbeatMsg();
                                    if (hearbeatMsg) {
                                        const [serverOutgoing, serverIncoming] = (frame.headers['heart-beat'] || '0,0').split(',').map((v: string) => parseInt(v, 10));
                                        heartbeat.startHeartbeat(serverOutgoing,
                                                                 serverIncoming,
                                                                {
                                                                    sendPing: () => wsConnection.messageSender.next(hearbeatMsg),
                                                                    close: (error) => connectionObserver.error(error)
                                                                });
                                    }

                                    connectionObserver.next({
                                            subscribeTo: subscribeTo,
                                            messageReceipted: stompMessageReceipted,
                                            errorReceived: errorReceived,
                                            messageSender: wsConnection.messageSender,
                                            protocol: currentProtocol
                                        }
                                    );
                                    break;
                                case 'MESSAGE':
                                    const subscription: string = currentProtocol.getSubscription(frame)
                                    const messageID: string = currentProtocol.getMessageId(frame);
                                    frame.ack = () => wsConnection.messageSender.next(currentProtocol.ack(messageID, subscription));
                                    currentProtocol.nack && (frame.nack = () => wsConnection.messageSender.next(currentProtocol.nack(messageID, subscription)));
                                    stompMessageReceived.next(frame)
                                    break;
                                case 'RECEIPT':
                                    stompMessageReceipted.next(frame);
                                    break;
                                case 'ERROR':
                                    errorReceived.next(frame);
                                    break;
                                default:
                                    logger.debug(`Unhandled frame: ${frame}`);
                            }
                        });
                })

                // sending connect
                wsConnection.messageSender.next(currentProtocol.connect(headers));

                disconnectFn = () => {
                      heartbeat.stopHeartbeat();
                      wsConnection.messageSender.next(currentProtocol.disconnect(headers));
                }

                return () => {
                    msgSubscription && msgSubscription.unsubscribe();
                    stompMessageReceived.complete();
                    stompMessageReceipted.complete();
                    errorReceived.complete();
                }

            })

        }).finally(() => {
            disconnectFn && disconnectFn();
        })
    }

    return { initConnection };

}

export default stompWebSocketHandler

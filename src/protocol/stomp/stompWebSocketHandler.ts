import { Observable } from 'rxjs/Observable';
import { Observer } from 'rxjs/Observer';
import { Subject } from 'rxjs/Subject';

import 'rxjs/add/operator/switchMap';

import { IEvent, IProtocol, IConnectedObservable, IWebSocketObservable } from '../../types';
import Frame from '../../frame';
import { ACK, AckHeaders, NackHeaders,
         ConnectedHeaders, ConnectionHeaders, DisconnectHeaders,
         SubscribeHeaders, UnsubscribeHeaders } from '../../headers';
import { VERSIONS, BYTES, typedArrayToUnicodeString } from '../../utils';
import WebSocketHandler from '../../webSocketHandler';
import stompProtocol from './stompProtocol';
import Heartbeat, { HeartbeatOptions } from '../../heartbeat';


// STOMP Handler Class
//
// Using stompProtocol
//
const stompWebSocketHandler = (wsHandler:WebSocketHandler,
                              headers: ConnectionHeaders,
                              heartbeatOption: HeartbeatOptions | boolean = {outgoing: 10000, incoming: 10000},
                              debug:(message: any, ...args: any[]) => void): Observable<IConnectedObservable> => {

    // creating the heartbeat
    const heartbeatSettings = (heartbeatOption as HeartbeatOptions) || {outgoing: 0, incoming: 0};
    const heartbeat = new Heartbeat(heartbeatSettings, debug);

    return wsHandler.initConnection(headers).switchMap((wsConnection: IWebSocketObservable) => {

        let counter: number = 0;
        let partialData: string = '';
        let version: string = '';
        let currentProtocol: IProtocol = stompProtocol(); // we initialise the current protocol with no version as we need it for CONNECT

        // Heart-beat negotiation
        const _setupHeartbeat = (_headers: ConnectedHeaders) => {
            const send = (data: any) => wsConnection.messageSender.next(data);
            heartbeat.startHeartbeat(_headers,
                                        { send: wsConnection.messageSender.next, close: wsConnection.closeConnection});
        }

        const _parseMessageReceived = (evt: IEvent): Frame[] => {
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

        const unSubscribe = (headers: UnsubscribeHeaders) => {
            wsConnection.messageSender.next(currentProtocol.unSubscribe(headers));
        }

        return Observable.create((connectionObserver: Observer<IConnectedObservable>) => {

            const stompMessageReceived = new Subject()
            const stompMessageReceipted = new Subject()
            const errorReceived = new Subject()

            const subscribeTo = (destination: string, headers: {id?: string, ack?: ACK} = {}): Observable<Frame> => {
                const id = headers.id || 'sub-' + counter++;
                const currentHeader: SubscribeHeaders = {destination, ack: headers.ack, id };
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
                                debug(`connected to server ${frame.headers.server}`);
                                // Check if we already have heart-beat in headers before adding them
                                if (!frame.headers['heart-beat']) {
                                    frame.headers['heart-beat'] = [heartbeatSettings.outgoing, heartbeatSettings.incoming].join(',');
                                }
                                _setupHeartbeat(frame.headers);
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
                                frame.nack = () => wsConnection.messageSender.next(currentProtocol.nack(messageID, subscription));
                                stompMessageReceived.next(frame)
                                break;
                            case 'RECEIPT':
                                stompMessageReceipted.next(frame);
                                break;
                            case 'ERROR':
                                errorReceived.next(frame);
                                break;
                            default:
                                debug(`Unhandled frame: ${frame}`);
                        }
                    });
            })

            // sending connect
            wsConnection.messageSender.next(currentProtocol.connect(headers));

            return () => {
                  heartbeat.stopHeartbeat();
                  wsConnection.messageSender.next(currentProtocol.disconnect(headers));
                  msgSubscription && msgSubscription.unsubscribe();
                  stompMessageReceived.complete();
                  stompMessageReceipted.complete();
                  errorReceived.complete();
            }

        })

    })

}

export default stompWebSocketHandler

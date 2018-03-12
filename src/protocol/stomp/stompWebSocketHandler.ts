import { Observable } from 'rxjs/Observable'
import { Observer } from 'rxjs/Observer'
import { Subject } from 'rxjs/Subject'

import 'rxjs/add/operator/filter'
import 'rxjs/add/operator/map'
import 'rxjs/add/operator/merge'
import 'rxjs/add/operator/mergeMap'
import { switchMapUntil } from '../../operator/switchMapUntil'

import { IEvent, IProtocol, IConnectedObservable, IWebSocketObservable, IWebSocketHandler, WsOptions, IWebSocket } from '../../types'
import Frame from '../../frame'
import { ACK, ConnectionHeaders, SubscribeHeaders, UnsubscribeHeaders } from '../../headers'
import { typedArrayToUnicodeString, logger, parseData } from '../../utils'
import WebSocketHandler from '../../webSocketHandler'
import stompProtocol from './stompProtocol'
import observableHeartbeat, {HeartbeatOptions} from '../../observableHeartbeat'

const parseHeartbeatSettings = (settings: HeartbeatOptions): string =>
    [settings.outgoing, settings.incoming].join(',')

const createMessageParser = () => {
    let partialData: string = ''

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
    let counter = 0
    // subscribing to message received
    const frameObservable: Observable<Frame> = wsConnection.messageReceived
        .flatMap(parseMessage.parseMessageReceived(protocol))

    // receipt message flux
    const stompMessageReceipted: Observable<Frame> = frameObservable
        .filter((frame: Frame) => frame.command === 'RECEIPT')

    // errorReceived flux
    const errorReceived: Observable<Frame> = frameObservable
        .filter((frame: Frame) => frame.command === 'ERROR')

    // Subscribing to a destination
    const subscribeTo = (destination: string, _headers: {id?: string, ack?: ACK} = {}): Observable<Frame> => {
        const id = _headers.id || 'sub-' + counter++
        const currentHeader: SubscribeHeaders = {destination, ack: _headers.ack, id }
        // sending subscribe to the server
        wsConnection.messageSender.next(protocol.subscribe(currentHeader))
        // subscribing to the messages from the subscription
        return frameObservable.filter((frame: Frame) => frame.command === 'MESSAGE')
                .filter((frame: Frame) => frame.headers.subscription === id)
                .map((frame: Frame) => {
                    const subscription: string = protocol.getSubscription(frame)
                    const messageID: string = protocol.getMessageId(frame)
                    frame.ack = () => wsConnection.messageSender.next(protocol.ack(messageID, subscription))
                    protocol.nack && (frame.nack = () => wsConnection.messageSender.next(protocol.nack(messageID, subscription)))
                    return frame
                }).finally(() => wsConnection.messageSender.next(protocol.unSubscribe({id})))
    }

    return Observable.create((stompWebSocketObserver: Observer<IConnectedObservable>) => {
        stompWebSocketObserver.next({ subscribeTo: subscribeTo,
                messageReceipted: stompMessageReceipted,
                errorReceived: errorReceived,
                messageSender: wsConnection.messageSender,
                protocol: protocol })
    })
}

// listen to the messages received from the connection
// to send a bit every n ms and check that we get a message every n ms
// note : we return any as it can be an Observable of anything
const createHeartbeatObservable = (wsConnection, protocol, frame, heartbeatClientSettings): Observable<any> => {
    // we start heartbeat only if the protocol support it
    const hearbeatMsg = protocol.hearbeatMsg()
    if (hearbeatMsg) {
        const [outgoing, incoming] = (frame.headers['heart-beat'] || '0,0').split(',').map((v: string) => parseInt(v, 10))

        const heartbeat = observableHeartbeat(heartbeatClientSettings,
            {outgoing, incoming},
            () => wsConnection.messageSender.next(hearbeatMsg))
        return wsConnection.messageReceived.pipe(heartbeat)
    } else {
        return Observable.empty()
    }
}


// STOMP Handler Class
//
// Using stompProtocol
//
const stompWebSocketHandler = (createWsConnection: () => IWebSocket, options: WsOptions): IWebSocketHandler<IConnectedObservable> => {

    const wsHandler: WebSocketHandler = new WebSocketHandler(createWsConnection, options)

    let heartbeatClientSettings: HeartbeatOptions = ((typeof options.heartbeat === 'boolean') ?
        {outgoing: 0, incoming: 0} : options.heartbeat) || {outgoing: 10000, incoming: 10000}

    const initConnection = (headers: ConnectionHeaders): Observable<IConnectedObservable> => {

        let currentHeaders: ConnectionHeaders = {...headers}
        // Check if we already have heart-beat in headers before adding them
        if (!headers['heart-beat']) {
            currentHeaders['heart-beat'] = parseHeartbeatSettings(heartbeatClientSettings)
        }
        const messageParser = createMessageParser()
        // we initialise the current protocol with no version as we need it for CONNECT / DISCONNECT
        let currentProtocol: IProtocol = stompProtocol()
        let counter: number = 0

        // first initialise the connection with the webSocket
        return wsHandler.initConnection(currentHeaders)
            .pipe(switchMapUntil((wsConnection: IWebSocketObservable, index: number, notifier: Subject<any>) => {
                // sending connect message to the server
                wsConnection.messageSender.next(currentProtocol.connect(currentHeaders))
                return wsConnection.messageReceived.flatMap(messageParser.parseMessageReceived(currentProtocol))
                    .filter((frame) => frame.command === 'CONNECTED')
                    .map((frame) => ({
                        wsConnection: wsConnection,
                        frame: frame,
                        protocol: stompProtocol(frame.headers.version)
                    }))
                    .finally(() => {
                        wsConnection.messageReceived.subscribe(() => {
                            notifier.complete()
                        })
                        wsConnection.messageSender.next(currentProtocol.disconnect({receipt: `${counter++}`}))
                    })
            }))
            .pipe(switchMapUntil((mappedFrame, index: number, notifier: Subject<any>) => {
                const {wsConnection, frame, protocol} = mappedFrame
                logger.debug(`connected to server ${frame.headers.server}`)
                // merging the heartbeat with the init connection
                return stompMessageObs(wsConnection, protocol, messageParser)
                    .merge(createHeartbeatObservable(wsConnection, protocol, frame, heartbeatClientSettings)).finally(() => {
                        notifier.complete()
                    })
            }))
    }

    return { initConnection }

}

export default stompWebSocketHandler

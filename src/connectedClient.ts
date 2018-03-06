import { Observer } from 'rxjs/Observer';
import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';
import { ConnectableObservable } from 'rxjs/Observable/ConnectableObservable';

import 'rxjs/add/operator/multicast';
import 'rxjs/add/operator/finally';

import { IConnectedObservable } from './types';
import Frame from './frame';
import { ACK, AckHeaders, SendHeaders } from './headers';

interface ISubscriptions {
    [key: string]: Observer<Frame>
}

interface IObservables {
    [key: string]: Observable<Frame>
}

export interface ConnectedClient {
    send: (destination: string, body: string, headers: SendHeaders) => void
    begin: (transaction?: string) => void
    commit: (transaction: string) => void
    abort: (transaction: string) => void
    ack: (messageID: string, subscription: string, headers?: AckHeaders) => void
    nack: (messageID: string, subscription: string, headers?: AckHeaders) => void
    receipt: () => Observable<Frame>
    connectionError: () => Observable<Frame>
    error: () => Observable<Frame>
    subscribe: (destination: string, headers: {id?: string, ack?: ACK}) => Observable<Frame>
    subscribeBroadcast: (destination: string, headers: {id?: string, ack?: ACK}) => Observable<Frame>
}

const createConnectedClient = (connection: IConnectedObservable): ConnectedClient  => {

    let broadcastObservables: IObservables = {}
    let broadcastReceipterObservable: Observable<Frame>
    let broadcastErrorObservable: Observable<Frame>
    let broadcastConnectionErrorObservable: Observable<Frame>

    const {messageSender, messageReceipted, subscribeTo, errorReceived, protocol} = connection

    const send = (destination: string, body: string = '', headers: SendHeaders = {destination}): void => {
        const headerToSend = { ...headers, destination};
        messageSender.next(protocol.send(headerToSend, body));
    }

    const begin = (transaction?: string): void => {
        messageSender.next(protocol.begin(transaction));
    }

    const commit = (transaction: string): void => {
        messageSender.next(protocol.commit(transaction));
    }

    const abort = (transaction: string): void => {
        messageSender.next(protocol.abort(transaction));
    }

    const ack = (messageID: string, subscription: string, headers?: AckHeaders): void => {
        messageSender.next(protocol.ack(messageID, subscription, headers));
    }

    // [NACK Frame](http://stomp.github.com/stomp-specification-1.1.html#NACK)
    const nack = (messageID: string, subscription: string, headers?: AckHeaders): void => {
        if (protocol.nack) {
            messageSender.next(protocol.nack(messageID, subscription, headers));
        } else {
            throw 'Nack unsupported operation';
        }
    }

    // [RECEIPT Frame](http://stomp.github.com/stomp-specification-1.1.html#RECEIPT)
    const receipt = (): Observable<Frame> => {

        // create one and only one broadcast receiver
        if (!broadcastReceipterObservable) {
                broadcastReceipterObservable = __multiCastMessageObs(messageReceipted)
        }
        return broadcastReceipterObservable;

    }

    // Return an Observable containing the event when a connection error occure
    const connectionError = (): Observable<Frame> => {

        // create one and only one broadcast receiver
        if (!broadcastConnectionErrorObservable) {
            broadcastConnectionErrorObservable = __multiCastMessageObs(errorReceived)
        }
        return broadcastConnectionErrorObservable;

    }

    // Return an Observable containing the error when an error occure
    const error = (): Observable<Frame> => {

        // create one and only one broadcast receiver
        if (!broadcastErrorObservable) {
            broadcastErrorObservable = __multiCastMessageObs(errorReceived)
        }
        return broadcastErrorObservable;

    }

    // subscribe to a destination
    // return an Observable which you can unsubscribe
    const subscribe = (destination: string, headers: {id?: string, ack?: ACK} = {}): Observable<Frame> => {
        return subscribeTo(destination, headers);
    }

    // subscribe to a destination only once for multiple subscribers
    // return an Observable which you can unsubscribe
    const subscribeBroadcast = (destination: string, headers: {id?: string, ack?: ACK} = {}): Observable<Frame> => {
        // create one and only one dedicated observable per destination
        if (!broadcastObservables[destination]) {
            const onFinal = () => broadcastObservables[destination] ? delete broadcastObservables[destination] : null
            broadcastObservables[destination] = __multiCastMessageObs(subscribe(destination, headers), onFinal)
        }
        return broadcastObservables[destination]
    }

    const __multiCastMessageObs = (messageObs: Observable<Frame>, onFinal?: () => void) => {
        const connectedSubscribe: ConnectableObservable<Frame> = messageObs
            .finally(onFinal)
            .multicast(() => new Subject())

        connectedSubscribe.connect();
        return connectedSubscribe.refCount();
    }

    return {send, begin, commit, abort, ack, nack, receipt, connectionError, error, subscribe, subscribeBroadcast}

}

export default createConnectedClient

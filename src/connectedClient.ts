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
    [key: string]: Observer<Frame>;
}

interface IObservables {
    [key: string]: Observable<Frame>;
}

// STOMP Connected Client Class
//
export class ConnectedClient {

    private connection: IConnectedObservable
    private broadcastSubscribers: IObservables
    private broadcastReceipterObservable: Observable<Frame>
    private broadcastReceipterObserver: Observer<Frame>
    private broadcastErrorObservable: Observable<Frame>
    private broadcastErrorObserver: Observer<Frame>
    private broadcastConnectionErrorObservable: Observable<Frame>
    private broadcastConnectionErrorObserver: Observer<Frame>

    constructor(connection: IConnectedObservable) {
        this.connection = connection;
        // subscription callbacks indexed by subscriber's ID
        this.broadcastSubscribers = {};
    }

    public send = (destination: string, body: string = '', headers: SendHeaders = {destination}): void => {
        const headerToSend = { ...headers, destination};
        this.connection.messageSender.next(this.connection.protocol.send(headerToSend, body));
    }

    public begin = (transaction?: string) => {
        this.connection.messageSender.next(this.connection.protocol.begin(transaction));
    }

    public commit = (transaction: string) => {
        this.connection.messageSender.next(this.connection.protocol.commit(transaction));
    }

    public abort = (transaction: string) => {
        this.connection.messageSender.next(this.connection.protocol.abort(transaction));
    }

    public ack = (messageID: string, subscription: string, headers?: AckHeaders) => {
        this.connection.messageSender.next(this.connection.protocol.ack(messageID, subscription, headers));
    }

    // [NACK Frame](http://stomp.github.com/stomp-specification-1.1.html#NACK)
    public nack = (messageID: string, subscription: string, headers?: AckHeaders) => {
        if (this.connection.protocol.nack) {
            this.connection.messageSender.next(this.connection.protocol.nack(messageID, subscription, headers));
        } else {
            throw 'Nack unsupported operation';
        }
    }

    // [RECEIPT Frame](http://stomp.github.com/stomp-specification-1.1.html#RECEIPT)
    public receipt = (): Observable<Frame> => {

        // create one and only one broadcast receiver
        if (!this.broadcastReceipterObservable) {
            const connectedSubscribe: ConnectableObservable<Frame> = this.connection.messageReceipted
                .finally(() => this.broadcastReceipterObserver ? this.broadcastReceipterObserver = null : null)
                .multicast(() => new Subject())

            connectedSubscribe.connect();
            this.broadcastReceipterObservable = connectedSubscribe.refCount();
        }
        return this.broadcastReceipterObservable;

    }

    // Return an Observable containing the event when a connection error occure
    public connectionError = (): Observable<Frame> => {

        // create one and only one broadcast receiver
        if (!this.broadcastConnectionErrorObservable) {
            const connectionErrorSubscribe: ConnectableObservable<Frame> = this.connection.errorReceived
                .finally(() => this.broadcastConnectionErrorObserver ? this.broadcastConnectionErrorObserver = null : null)
                .multicast(() => new Subject())

            connectionErrorSubscribe.connect();
            this.broadcastConnectionErrorObservable = connectionErrorSubscribe.refCount();
        }
        return this.broadcastConnectionErrorObservable;

    }

    // Return an Observable containing the error when an error occure
    public error = (): Observable<Frame> => {

        // create one and only one broadcast receiver
        if (!this.broadcastErrorObservable) {
            const connectedSubscribe: ConnectableObservable<Frame> = this.connection.errorReceived
                .finally(() => this.broadcastErrorObserver ? this.broadcastErrorObserver = null : null)
                .multicast(() => new Subject())

            connectedSubscribe.connect();
            this.broadcastErrorObservable = connectedSubscribe.refCount();
        }
        return this.broadcastErrorObservable;

    }

    // subscribe to a destination
    // return an Observable which you can unsubscribe
    public subscribe = (destination: string, headers: {id?: string, ack?: ACK} = {}): Observable<Frame> => {
        return this.connection.subscribeTo(destination, headers);
    }

    // subscribe to a destination only once for multiple subscribers
    // return an Observable which you can unsubscribe
    public subscribeBroadcast = (destination: string, headers: {id?: string, ack?: ACK} = {}): Observable<Frame> => {
        // create one and only one dedicated observable per destination
        if (!this.broadcastSubscribers[destination]) {
            const connectedSubscribe: ConnectableObservable<Frame> = this.subscribe(destination, headers)
                .finally(() => this.broadcastSubscribers[destination] ? delete this.broadcastSubscribers[destination] : null)
                .multicast(() => new Subject())

            connectedSubscribe.connect();
            this.broadcastSubscribers[destination] = connectedSubscribe.refCount();
        }
        return this.broadcastSubscribers[destination];
    }

}

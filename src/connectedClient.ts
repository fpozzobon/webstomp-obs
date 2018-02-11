import { Observer } from 'rxjs/Observer';
import { Observable } from 'rxjs/Observable';
import WebSocketHandler from './webSocketHandler';
import { Subject } from 'rxjs/Subject';
import { ConnectableObservable } from 'rxjs/Observable/ConnectableObservable';
import 'rxjs/add/operator/multicast';
import 'rxjs/add/operator/finally';
import Frame from './frame';
import { ACK, AckHeaders, SendHeaders, SubscribeHeaders } from './headers';
import 'rxjs/add/operator/filter';

interface ISubscriptions {
    [key: string]: Observer<Frame>;
}

interface IObservables {
    [key: string]: Observable<Frame>;
}

// STOMP Connected Client Class
//
export class ConnectedClient {

    private webSocketClient: WebSocketHandler
    private counter: number
    private subscriptions: ISubscriptions
    private broadcastSubscribers: IObservables
    private broadcastReceipterObservable: Observable<Frame>
    private broadcastReceipterObserver: Observer<Frame>
    private broadcastErrorObservable: Observable<Frame>
    private broadcastErrorObserver: Observer<Frame>
    private broadcastConnectionErrorObservable: Observable<CloseEvent>
    private broadcastConnectionErrorObserver: Observer<CloseEvent>

    constructor(webSocketClient: WebSocketHandler) {

        this.webSocketClient = webSocketClient;

        // used to index subscribers
        this.counter = 0;
        // subscription callbacks indexed by subscriber's ID
        this.broadcastSubscribers = {};
    }

    // [SEND Frame](http://stomp.github.com/stomp-specification-1.1.html#SEND)
    public send = (destination: string, body: string = '', headers: SendHeaders = {destination}): void => {
        const headerToSend = { ...headers, destination};
        this.webSocketClient.send(headerToSend, body);
    }

    // [BEGIN Frame](http://stomp.github.com/stomp-specification-1.1.html#BEGIN)
    public begin = (transaction?: string) => {
        return this.webSocketClient.begin(transaction);
    }

    // [COMMIT Frame](http://stomp.github.com/stomp-specification-1.1.html#COMMIT)
    public commit = (transaction: string) => {
        this.webSocketClient.commit(transaction);
    }

    // [ABORT Frame](http://stomp.github.com/stomp-specification-1.1.html#ABORT)
    public abort = (transaction: string) => {
        this.webSocketClient.abort(transaction);
    }

    // [ACK Frame](http://stomp.github.com/stomp-specification-1.1.html#ACK)
    public ack = (messageID: string, subscription: string, headers?: AckHeaders) => {
        this.webSocketClient.ack(messageID, subscription, headers)
    }

    // [NACK Frame](http://stomp.github.com/stomp-specification-1.1.html#NACK)
    public nack = (messageID: string, subscription: string, headers?: AckHeaders) => {
        this.webSocketClient.nack(messageID, subscription, headers)
    }

    // [RECEIPT Frame](http://stomp.github.com/stomp-specification-1.1.html#RECEIPT)
    public receipt = (): Observable<Frame> => {

        // create one and only one broadcast receiver
        if (!this.broadcastReceipterObservable) {
            const connectedSubscribe: ConnectableObservable<Frame> = this.webSocketClient.messageReceiptedObservable
                .finally(() => this.broadcastReceipterObserver ? this.broadcastReceipterObserver = null : null)
                .multicast(() => new Subject())

            connectedSubscribe.connect();
            this.broadcastReceipterObservable = connectedSubscribe.refCount();
        }
        return this.broadcastReceipterObservable;

    }

    // Return an Observable containing the event when a connection error occure
    public connectionError = (): Observable<CloseEvent> => {

        // create one and only one broadcast receiver
        if (!this.broadcastConnectionErrorObservable) {
            const connectionErrorSubscribe: ConnectableObservable<CloseEvent> = this.webSocketClient.connectionErrorObservable
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
            const connectedSubscribe: ConnectableObservable<Frame> = this.webSocketClient.errorReceivedObservable
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
        const id = headers.id || 'sub-' + this.counter++;
        const currentHeader: SubscribeHeaders = {destination, ack: headers.ack, id };
        return this.webSocketClient.subscribe(currentHeader).filter(
          (frame: Frame) => frame.headers.subscription === id
        );
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

import { Observer } from 'rxjs/Observer';
import { Observable } from 'rxjs/Observable';
import WebSocketHandler from './webSocketHandler';
import { Subject } from 'rxjs/Subject';
import { ConnectableObservable } from 'rxjs/Observable/ConnectableObservable';
import 'rxjs/add/operator/multicast';
import 'rxjs/add/operator/finally';
import Frame from './frame';

interface ISubscriptions {
    [key: string]: Observer<Frame>;
}

interface IObservables {
    [key: string]: Observable<Frame>;
}

export interface ConnectionHeaders {
    login: string;
    passcode: string;
    host?: string;
    'accept-version'?: string;
    'heart-beat'?: string;
}

export interface DisconnectHeaders {
    'receipt'?: string;
}

export interface StandardHeaders extends DisconnectHeaders {
    'content-length'?: string;
    'content-type'?: string;
}

export interface ExtendedHeaders extends StandardHeaders {
    'amqp-message-id'?: string,
    'app-id'?: string,
    'content-encoding'?: string,
    'correlation-id'?: string,
    custom?: string,
    destination?: string,
    'message-id'?: string,
    persistent?: string,
    redelivered?: string,
    'reply-to'?: string,
    subscription?: string,
    timestamp?: string,
    type?: string,
}

export interface UnsubscribeHeaders extends StandardHeaders {
    id?: string,
}

export interface SubscribeHeaders extends UnsubscribeHeaders {
    ack?: string,
    destination?: string
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

    constructor(webSocketClient: WebSocketHandler) {

        this.webSocketClient = webSocketClient;
        this.webSocketClient.onMessageReceived = this._onMessageReceivedFn
        this.webSocketClient.onMessageReceipted = this._onMessageReceiptedFn
        // used to index subscribers
        this.counter = 0;
        // subscription callbacks indexed by subscriber's ID
        this.subscriptions = {};
        this.broadcastSubscribers = {};
    }

    // on Message event
    // return true if it can handle the reception, false otherwise
    private _onMessageReceivedFn = (subscription: number): (Frame) => void => {
        // the `_onMessageReceivedFn` callback is registered when the client calls
        // `subscribe()`.
        const onreceive: (Frame) => void = this.subscriptions[subscription] && this.subscriptions[subscription].next.bind(this.subscriptions[subscription]);
        return onreceive
    }

    // on Message Receipt event
    // return true if it can handle the reception, false otherwise
    private _onMessageReceiptedFn = (): (Frame) => void => {
        // the `_onMessageReceiptedFn` callback is registered when the client calls
        // `receipt()`.
        const onreceipt: (Frame) => void = this.broadcastReceipterObserver && this.broadcastReceipterObserver.next.bind(this.broadcastReceipterObserver);
        return onreceipt
    }

    // [SEND Frame](http://stomp.github.com/stomp-specification-1.1.html#SEND)
    public send = (destination: string, body: string = '', headers: ExtendedHeaders = {}): void => {
        headers.destination = destination;
        this.webSocketClient.send(headers, body);
    }

    // [BEGIN Frame](http://stomp.github.com/stomp-specification-1.1.html#BEGIN)
    public begin = (transaction?: any) => {
        return this.webSocketClient.begin(transaction);
    }

    // [COMMIT Frame](http://stomp.github.com/stomp-specification-1.1.html#COMMIT)
    public commit = (transaction: any) => {
        this.webSocketClient.commit(transaction);
    }

    // [ABORT Frame](http://stomp.github.com/stomp-specification-1.1.html#ABORT)
    public abort = (transaction: any) => {
        this.webSocketClient.abort(transaction);
    }

    // [ACK Frame](http://stomp.github.com/stomp-specification-1.1.html#ACK)
    public ack = (messageID: string, subscription: string, headers = {}) => {
        this.webSocketClient.ack(messageID, subscription, headers)
    }

    // [NACK Frame](http://stomp.github.com/stomp-specification-1.1.html#NACK)
    public nack = (messageID: string, subscription: string, headers = {}) => {
        this.webSocketClient.nack(messageID, subscription, headers)
    }

    // [RECEIPT Frame](http://stomp.github.com/stomp-specification-1.1.html#RECEIPT)
    public receipt = (): Observable<Frame> => {

        // create one and only one broadcast receiver
        if (!this.broadcastReceipterObservable) {
            const connectedSubscribe: ConnectableObservable<Frame> = Observable.create((observer: Observer<Frame>) => {
                    this.broadcastReceipterObserver = observer
                })
                .finally(() => this.broadcastReceipterObserver ? this.broadcastReceipterObserver = null : null)
                .multicast(() => new Subject())

            connectedSubscribe.connect();
            this.broadcastReceipterObservable = connectedSubscribe.refCount();
        }
        return this.broadcastReceipterObservable;

    }
    
    // subscribe to a destination
    // return an Observable which you can unsubscribe
    public subscribe = (destination: string, headers: SubscribeHeaders = {}): Observable<Frame> => {

        return Observable.create((observer: Observer<Frame>) => {
            // for convenience if the `id` header is not set, we create a new one for this client
            // that will be returned to be able to unsubscribe this subscription
            if (!headers.id) headers.id = 'sub-' + this.counter++;
            headers.destination = destination;
            this.subscriptions[headers.id] = observer;

            this.webSocketClient.subscribe(headers);
            return () => {
                this.webSocketClient.unSubscribe(headers);
                delete this.subscriptions[headers.id];
                headers.id = headers.id;
            };
        })

    }

    // subscribe to a destination only once for multiple subscribers
    // return an Observable which you can unsubscribe
    public subscribeBroadcast = (destination: string, headers: SubscribeHeaders = {}): Observable<Frame> => {
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


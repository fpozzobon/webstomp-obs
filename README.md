# webstomp-obs

This library provides a [stomp](https://stomp.github.io/) client for Web browsers and nodejs through Web Sockets.

## Project Status

This is a fork of the original [webstomp-client] (https://github.com/JSteunou/webstomp-client) (which is a fork of the original [stomp-websocket](https://github.com/jmesnil/stomp-websocket))
re-written to use rxjs Observables. All credits goes to the original authors: Jérôme Steunou & Jeff Mesnil & Jeff Lindsay.

## Browsers support

Only ES5 compatible modern browsers are supported. If you need a websocket polyfill you can use [sockjs](http://sockjs.org)

## Example

`npm run example` will open examples in browser and try to connect to [RabbitMQ Web-Stomp](https://www.rabbitmq.com/web-stomp.html) default Web Sockets url.

## API

Jeff Mesnil stomp-websocket [documentation](http://jmesnil.net/stomp-websocket/doc/) is still a must read even if the API [evolved](CHANGELOG.md) a little

### stompobs

#### client(url, [options], protocols? )

Uses global `WebSocket` object for you to return a stompobs `Client` object.
with protocols by default to `['v10.stomp', 'v11.stomp', 'v12.stomp']`

##### url<String>

Web Sockets endpoint url

##### options<Object>

* maxConnectAttempt: default to 10 - number of reconnecting attempt before throwing an error (calling createWsConnection to attempt the connection)
  note : -1 won't try to reconnect at all
* ttlConnectAttempt: default to 1000 - each attempt of reconnection will wait ttlConnectAttempt * <reconnection attempt number> before reconnecting
* binary: default to `false`. See [binary](#binary) section.
* heartbeat: default to `{incoming: 10000, outgoing: 10000}`. You can provide `false` to cut it (recommended when the server is a SockJS server) or a definition object.
* debug: default to `true`. Will log frame using `console.log`


#### over(createWsConnection, [options])

Takes a function createWsConnection returning a `WebSocket` alike object **instance** to return a webstomp `Client` object.
Allows you to use another `WebSocket` object than the default one. 2 cases for this:
* you do not want `webstomp.client` to create a default instance for you.
* you are in an old browser or nodejs and do not have a global `WebSocket` object that `webstomp.client` can use.

##### createWsConnection

function returning a `WebSocket` object instance (connected to the chosen url)

##### options<Object>

same as up for client function

### VERSIONS

#### supportedVersions()

List all STOMP specifications supported.

#### supportedProtocols()

List all websocket STOMP protocols supported. Useful when creating your own `WebSocket` instance, although optional, protocols is often the second parameter.

### Client

A client instance can and should be created through `stompobs.client` or `stompobs.over`

#### connect

Return an Observable<ConnectedClient> which you can subscribe to multiple subscribers.
Disconnect automatically when the last subscriber unsubscribe.
Each time that a new connection is initiated, the observers will receive a new ConnectedClient

### ConnectedClient

A connectedClient instance returned onNext by Client.connect after subscribing (and a connection has been successfully initiated)

Note : to disconnect the connectedClient you need to unsubscribe to the Client.connect, if no subscribers are remaining, the ws will be effectively disconnected

### send(destination: string, body?: string, headers?: ExtendedHeaders): void;

Send a message to the destination "destination"
Note : the websocket should throw an exception if sending is not possible (disconnected ws for example), and the consumer should catch it if necessary

### begin(transaction?: any): {
        id: any;
        commit: any;
        abort: any;
    };

If no transaction ID is passed, one will be created automatically

#### commit(transaction: any): void;

It is preferable to commit a transaction by calling `commit()` directly on the object returned by `client.begin()`:

```js
var tx = connectedClient.begin(txid);
...
tx.commit();
```

### abort(transaction: any): void;

It is preferable to abort a transaction by calling `abort()` directly on the object returned by `client.begin()`:

```js
var tx = connectedClient.begin(txid);
...
tx.abort();
```

### ack(messageID: any, subscription: any, headers?: {}): void;

It is preferable to acknowledge a message by calling `ack()` directly on the message handled by a subscription callback:

```js
var source = connectedClient.subscribe('webstomp-tasks-example');

var subscription = source.subscribe(
        function (message) {
            message.ack();

```

### nack(messageID: any, subscription: any, headers?: {}): void;

```js
var source = connectedClient.subscribe('webstomp-tasks-example');

var subscription = source.subscribe(
        function (message) {
            message.nack();

```

### receipt(): Observable<any>;

Will give back an Observable to subscribe to get the receipt event.

### error(): Observable<any>;

Will give back an Observable to subscribe to get the error event.

### subscribe(destination: string, headers?: SubscribeHeaders): Observable<any>;

Initialise an UNIQUE subscription with the websocket on a destination (usefull for the queue for example)
To unsubscribe to the destination, you call call subscription.unsubscribe()

```js

var source = connectedClient.subscribe('webstomp-tasks-example');

var subscription = source.subscribe(
        function (message) {
            onMessage(currentLine, message);
        },
        function (err) {
            onError(err);
        },
        function () {
            console.log('Completed');
        }
);

```


### subscribeBroadcast(destination: string, headers?: SubscribeHeaders): Observable<any>;

Initialise a BROADCAST subscription with the websocket per destination (usefull for the topic for example),
by using this, if you subscribes multiple times to the same destination using the same connected client,
no new subscription will be initiated.
To unsubscribe to the destination, you call call subscription.unsubscribe()
The unsubscribe will be effective when no other is subscribing to the same destination.

```js

var source = connectedClient.subscribeBroadcast('webstomp-tasks-example');

var subscription = source.subscribe(
        function (message) {
            onMessage(currentLine, message);
        },
        function (err) {
            onError(err);
        },
        function () {
            console.log('Completed');
        }
);

```

#### debug

Will use `console.log` by default. Override it to update its behavior.

## Binary

It is possible to use binary frame instead of string frame over Web Sockets.

* client side: set the binary option to true.
* server side: use a compatible websocket server, like with [RabbitMQ Web-Stomp](https://www.rabbitmq.com/web-stomp.html) since 3.6

## Hearbeat

Not all server are compatible, you may have to deactivate this feature depending the server you are using. For example RabbitMQ Web-Stomp is compatible only since 3.6 with native Web Sockets server.

## Authors

* [Fabien Pozzobon](https://github.com/fpozzobon)
* [Jérôme Steunou](https://github.com/JSteunou)
* [Jeff Mesnil](http://jmesnil.net/)
* [Jeff Lindsay](http://github.com/progrium)

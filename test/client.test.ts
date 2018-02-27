import { expect } from 'chai'
import * as Sinon from 'sinon'
import Client, {ClientOptions} from '../src/client'
import { Observable } from 'rxjs/Observable'
import * as connectedClient from '../src/connectedClient'
import * as WebSocketHandler from '../src/webSocketHandler'
import * as stompWebSocketHandler from '../src/protocol/stomp/stompWebSocketHandler';
import { IWebSocketHandler, IConnectedObservable } from '../src/types';

describe ('Stompobservable client', () => {
    const TTL = 100
    let expectedCreateWsConnection
    let expectedOptions
    let connectCallback
    let disconnectCallback
    let connectedClientSpy
    const initConnectionStub = Sinon.stub()
    const unsubscribeStub = Sinon.stub()
    const connectedStub = Sinon.stub()
    const stompWebSocketHandlerMock = {
        initConnection: (headers: any): Observable<IConnectedObservable> => {
             return Observable.create((observer) => {
                initConnectionStub(headers)
                disconnectCallback = () => observer.error("Disconnected")
                connectCallback = () => observer.next(connectedStub)
                return unsubscribeStub
             })
        }
    }
    const webSocketHandlerStub = Sinon.stub()
    let webSocketHandlerSpy
    let stompWebSocketHandlerSpy

    beforeEach( () => {
        webSocketHandlerSpy = Sinon.stub(WebSocketHandler, 'default').returns(webSocketHandlerStub)
        connectedClientSpy = Sinon.spy(connectedClient, 'ConnectedClient')
        stompWebSocketHandlerSpy = Sinon.stub(stompWebSocketHandler, 'default')
                                   .returns(stompWebSocketHandlerMock)
        expectedCreateWsConnection = Sinon.stub()
        expectedOptions = {maxConnectAttempt: 2, ttlConnectAttempt: TTL}
        this.clock = Sinon.useFakeTimers()
    })

    afterEach( () => {
        connectedClientSpy.reset()
        connectedClientSpy.restore()
        webSocketHandlerSpy.reset()
        webSocketHandlerSpy.restore()
        stompWebSocketHandlerSpy.reset()
        stompWebSocketHandlerSpy.restore()
        expectedCreateWsConnection.reset()
        initConnectionStub.reset()
        unsubscribeStub.reset()
        this.clock.restore()
    })

    describe ('constructor', () => {

        it ('should create a new WebSocketHandler passing createWsConnection and options parameters', () => {
            const actualClient = new Client(expectedCreateWsConnection, expectedOptions)
            expect(webSocketHandlerSpy.calledWithNew()).to.be.true
            Sinon.assert.calledWith(webSocketHandlerSpy, expectedCreateWsConnection, expectedOptions)
            Sinon.assert.calledOnce(stompWebSocketHandlerSpy)
        })
    })

    describe ('connect', () => {
        let testedClient
        const expectedHeaders = Sinon.stub() as any

        beforeEach( () => {
            testedClient = new Client(expectedCreateWsConnection, expectedOptions)
        })

        it ('should create an Observable', () => {
            const actualObservable = testedClient.connect(expectedHeaders)
            Sinon.assert.calledOnce(initConnectionStub)
            Sinon.assert.calledWith(initConnectionStub, expectedHeaders)
        })

        it ('should not create a new Observable if already connected', () => {
            const expectedObservable = testedClient.connect(expectedHeaders)
            const actualObservable = testedClient.connect(expectedHeaders)
            Sinon.assert.calledOnce(initConnectionStub)
            expect(actualObservable).to.equal(expectedObservable)
        })

    })

    describe ('subscribe to a connected client', () => {

        let testedClient

        beforeEach( () => {
            testedClient = new Client(expectedCreateWsConnection, expectedOptions)
        })

        it ('should call success for the subscribed observer if it connects', (done) => {
            testedClient.connect({})
                        .subscribe(
                            (client) => {
                                expect(connectedClientSpy.calledWithNew()).to.be.true
                                Sinon.assert.calledWith(connectedClientSpy, connectedStub)
                                expect(client).to.equal(connectedClientSpy.getCall(0).returnValue)
                                done()
                            },
                            (err) => done("unexpected " + err),
                            () => done("unexpected")
                        )
            connectCallback()
        })

        it ('should call error for the subscribed observer if it does not connect after n attempts', (done) => {
            testedClient.connect({})
                        .subscribe(
                            (client) => done("unexpected"),
                            (err) => {
                                Sinon.assert.called(unsubscribeStub)
                                done()
                            },
                            () => done("unexpected")
                        )
            disconnectCallback()
            disconnectCallback()
        })

        it ('should automatically reconnect after disconnect', (done) => {
            let nbCall = 0;
            testedClient.connect({})
            .subscribe(
                (client) => {
                    expect(client).to.equal(connectedClientSpy.getCall(nbCall).returnValue)
                    if (nbCall > 0) {
                        Sinon.assert.calledOnce(unsubscribeStub)
                        Sinon.assert.calledTwice(initConnectionStub)
                        done()
                    }
                    nbCall++;
                },
                (err) => done("unexpected " + err),
                () => done("unexpected")
            )
            connectCallback()
            disconnectCallback()
            this.clock.tick(TTL)
            connectCallback()
        })

    })

    describe ('unsubscribe to a connection', () => {

        let testedClient
        let source

        beforeEach( () => {
            testedClient = new Client(expectedCreateWsConnection, expectedOptions)
            source = testedClient.connect({})
        })

        it ('should automatically disconnect after unsubscribe', (done) => {
            let nbCall = 0;
            const subscription = source.subscribe(
                    (client) => {
                        if (nbCall > 0) {
                            done("unexpected")
                        }
                        nbCall++;
                    },
                    (err) => done("unexpected " + err),
                    () => done("unexpected")
                )
            connectCallback()

            subscription.unsubscribe()
            Sinon.assert.calledOnce(unsubscribeStub)
            done()

        })

        it ('should automatically disconnect after the last unsubscribe', (done) => {
            let nbCall = 0;
            const subscription1 = source.subscribe(
                    (client) => null,
                    (err) => done("unexpected " + err),
                    () => done("unexpected")
                )
            const subscription2 = source.subscribe(
                    (client) => null,
                    (err) => done("unexpected " + err),
                    () => done("unexpected")
                )
            connectCallback()

            subscription1.unsubscribe()
            Sinon.assert.notCalled(unsubscribeStub)
            subscription2.unsubscribe()
            Sinon.assert.calledOnce(unsubscribeStub)
            done()

        })

    })

});

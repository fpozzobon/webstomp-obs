import { expect } from 'chai'
import * as Sinon from 'sinon'
import Client, {ClientOptions} from '../src/client'
import { Observable } from 'rxjs/Observable'
import * as connectedClient from '../src/connectedClient'
import * as WebSocketHandler from '../src/webSocketHandler'

describe ('Stompobservable client', () => {
    const TTL = 100
    let expectedCreateWsConnection 
    let expectedOptions
    let connectCallback
    let disconnectCallback
    let connectedClientSpy
    const webSocketHandlerMock = {
        initConnection: (headers: any,
                             onDisconnect: (ev: any) => void) => {
                                 disconnectCallback = onDisconnect
                                 return Observable.create((observer) => connectCallback = () => observer.next(null))
                                },
        disconnect: Sinon.stub()
    }
    let webSocketHandlerSpy
    let initConnectionSpy

    beforeEach( () => {
        connectedClientSpy = Sinon.spy(connectedClient, 'ConnectedClient')
        webSocketHandlerSpy = Sinon.stub(WebSocketHandler, 'default')
                                   .returns(webSocketHandlerMock)
        expectedCreateWsConnection = Sinon.stub()
        initConnectionSpy = Sinon.spy(webSocketHandlerMock, 'initConnection')
        expectedOptions = {maxConnectAttempt: 2, ttlConnectAttempt: TTL}
        this.clock = Sinon.useFakeTimers()
    })

    afterEach( () => {
        connectedClientSpy.reset()
        connectedClientSpy.restore()
        webSocketHandlerSpy.reset()
        webSocketHandlerSpy.restore()
        expectedCreateWsConnection.reset()
        webSocketHandlerMock.disconnect.reset()
        initConnectionSpy.reset()
        initConnectionSpy.restore()
        this.clock.restore()
    })

    describe ('constructor', () => {

        it ('should create a new WebSocketHandler passing createWsConnection and options parameters', () => {
            const actualClient = new Client(expectedCreateWsConnection, expectedOptions)
            expect(webSocketHandlerSpy.calledWithNew()).to.be.true
            Sinon.assert.calledWith(webSocketHandlerSpy, expectedCreateWsConnection, expectedOptions)
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
            Sinon.assert.calledOnce(initConnectionSpy)
            Sinon.assert.calledWith(initConnectionSpy, expectedHeaders)
        })
        
        it ('should not create a new Observable if already connected', () => {
            const expectedObservable = testedClient.connect(expectedHeaders)
            const actualObservable = testedClient.connect(expectedHeaders)
            Sinon.assert.calledOnce(initConnectionSpy)
            expect(actualObservable).to.equal(expectedObservable)
        })
        
    })

    describe ('subscribe to a connected client', () => {

        let testedClient
        let webSocketHandlerInstance

        beforeEach( () => {
            testedClient = new Client(expectedCreateWsConnection, expectedOptions)
            webSocketHandlerInstance = webSocketHandlerSpy.getCall(0).returnValue
        })

        it ('should call success for the subscribed observer if it connects', (done) => {
            testedClient.connect({})
                        .subscribe(
                            (client) => {
                                expect(connectedClientSpy.calledWithNew()).to.be.true
                                Sinon.assert.calledWith(connectedClientSpy, webSocketHandlerInstance)
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
                                Sinon.assert.notCalled(webSocketHandlerMock.disconnect)
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
                        Sinon.assert.notCalled(webSocketHandlerMock.disconnect)
                        Sinon.assert.calledTwice(initConnectionSpy)
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
            Sinon.assert.calledOnce(webSocketHandlerMock.disconnect)
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
            Sinon.assert.notCalled(webSocketHandlerMock.disconnect)
            subscription2.unsubscribe()
            Sinon.assert.calledOnce(webSocketHandlerMock.disconnect)
            done()
            
        })

        it ('should not disconnect after unsubscribe if not connected', (done) => {
            let nbCall = 0;
            const subscription = source.subscribe(
                    (client) => null,
                    (err) => done("unexpected " + err),
                    () => done("unexpected")
                )
            
            subscription.unsubscribe()
            Sinon.assert.notCalled(webSocketHandlerMock.disconnect)
            done()
            
        })

    })

});
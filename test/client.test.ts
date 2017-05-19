import { expect } from 'chai'
import * as Sinon from 'sinon'
import Client, {ClientOptions} from '../src/client'
import { Observable } from 'rxjs/Observable'

let MockedCC = require ('../src/connectedClient')
let WebSocketHandler = require ('../src/webSocketHandler')

describe ('Stompobservable client', () => {
    let expectedCreateWsConnection 
    let expectedOptions
    let connectCallback
    let disconnectCallback;

    beforeEach( () => {
        MockedCC.ConnectedClient = Sinon.stub()
        WebSocketHandler.default = Sinon.stub().returns({
            initConnection: (headers: any,
                             onDisconnect: (ev: any) => void) => {
                                 disconnectCallback = onDisconnect
                                 return Observable.create((observer) => connectCallback = () => observer.next(null))
                                },
            disconnect: () => null
        })
        expectedCreateWsConnection = Sinon.stub()
        expectedOptions = {maxConnectAttempt: 2, ttlConnectAttempt: 1}
    })

    afterEach( () => {
        MockedCC.ConnectedClient.reset()
        WebSocketHandler.default.reset()
        expectedCreateWsConnection.reset()
    })

    describe ('constructor', () => {

        it ('should create a new WebSocketHandler passing createWsConnection and options parameters', () => {
            const actualClient = new Client(expectedCreateWsConnection, expectedOptions)
            expect(WebSocketHandler.default.calledWithNew()).to.be.true
            Sinon.assert.calledWith(WebSocketHandler.default, expectedCreateWsConnection, expectedOptions)
        })

    })

    describe ('connect', () => {
        let testedClient
        const expectedHeaders = Sinon.stub() as any
        let initConnectionSpy
        let webSocketHandlerInstance

        beforeEach( () => {
            testedClient = new Client(expectedCreateWsConnection, expectedOptions)
            webSocketHandlerInstance = WebSocketHandler.default.getCall(0).returnValue
            initConnectionSpy = Sinon.spy(webSocketHandlerInstance, 'initConnection')
        })

        afterEach( () => {
            initConnectionSpy.reset()
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
        let initConnectionSpy
        let disconnectSpy
        let webSocketHandlerInstance

        beforeEach( () => {
            testedClient = new Client(expectedCreateWsConnection, expectedOptions)
            webSocketHandlerInstance = WebSocketHandler.default.getCall(0).returnValue
            initConnectionSpy = Sinon.spy(webSocketHandlerInstance, 'initConnection')
            disconnectSpy = Sinon.spy(webSocketHandlerInstance, 'disconnect')
        })

        afterEach( () => {
            initConnectionSpy.reset()
            disconnectSpy.reset()
        })

        it ('should call success for the subscribed observer if it connects', (done) => {
            testedClient.connect({})
                        .subscribe(
                            (connectedClient) => {
                                expect(MockedCC.ConnectedClient.calledWithNew()).to.be.true
                                Sinon.assert.calledWith(MockedCC.ConnectedClient, webSocketHandlerInstance)
                                expect(connectedClient).to.equal(MockedCC.ConnectedClient.getCall(0).returnValue)
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
                            (connectedClient) => done("unexpected"),
                            (err) => {
                                Sinon.assert.calledOnce(disconnectSpy)
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
                (connectedClient) => {
                    expect(connectedClient).to.equal(MockedCC.ConnectedClient.getCall(nbCall).returnValue)
                    if (nbCall > 0) {
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
            setTimeout(connectCallback, 100)
        })

    })

});
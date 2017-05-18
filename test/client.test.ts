import { expect } from 'chai'
import * as Sinon from 'sinon'
import Client, {ClientOptions} from '../src/client'
import { Observable } from 'rxjs/Observable'

let MockedCC = require ('../src/connectedClient')
let WebSocketHandler = require ('../src/webSocketHandler')

describe ('Stompobservable client', () => {
    let expectedCreateWsConnection 
    let expectedOptions

    beforeEach( () => {
        MockedCC.ConnectedClient = Sinon.stub()
        WebSocketHandler.default = Sinon.stub().returns({
            initConnection: (headers: any, onDisconnect: (ev: any) => void) => Observable.create(Sinon.stub())
        })
        expectedCreateWsConnection = Sinon.stub()
        expectedOptions = Sinon.stub() as any
    })

    afterEach( () => {
        MockedCC.ConnectedClient.reset()
        WebSocketHandler.default.reset()
        expectedCreateWsConnection.reset()
        expectedOptions.reset()
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

        beforeEach( () => {
            testedClient = new Client(expectedCreateWsConnection, expectedOptions)
            initConnectionSpy = Sinon.spy(WebSocketHandler.default.getCall(0).returnValue, 'initConnection')
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

});
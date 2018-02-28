import { expect } from 'chai'
import * as Sinon from 'sinon'
import { Observable } from 'rxjs/Observable'
import { Subject } from 'rxjs/Subject';

import stompWebSocketHandler from '../../../src/protocol/stomp/stompWebSocketHandler'
import * as WebSocketHandler from '../../../src/webSocketHandler'
import * as Heartbeat from '../../../src/heartbeat'

describe ('stompWebSocketHandler', () => {

    let wsHandlerStub
    let heartbeatStub

    const createWsConnectionStub: any = Sinon.stub()
    const optionsStub: any = Sinon.stub()
    const initConnectionStub = Sinon.stub()
    let disconnectCallback
    let connectCallback
    const messageReceivedSubject = new Subject()
    const messageSenderSubject = new Subject()

    const wsHandlerMock = {
        initConnection: (headers: any) => {
            return Observable.create((observer) => {
                initConnectionStub()
                disconnectCallback = () => observer.error("an error")
                connectCallback = () => observer.next(messageReceivedSubject, messageSenderSubject)
            })
        }
    }

    const heartbeatMock = {
        startHeartbeat: Sinon.stub(),
        stopHeartbeat: Sinon.stub(),
        activityFromServer: Sinon.stub()
    }

    beforeEach (() => {
        wsHandlerStub = Sinon.stub(WebSocketHandler, 'default').returns(wsHandlerMock)
        heartbeatStub = Sinon.stub(Heartbeat, 'default').returns(heartbeatMock)
    })

    afterEach (() => {
        wsHandlerStub.reset()
        wsHandlerStub.restore()
        heartbeatStub.reset()
        heartbeatStub.restore()
        createWsConnectionStub.reset()
        optionsStub.reset()
        initConnectionStub.reset()
    })

    describe ('calling the default function ', () => {

        it ('should create a wsHandler with the right parameters', () => {
            // Testing
            stompWebSocketHandler(createWsConnectionStub, optionsStub)
            // verification
            expect(wsHandlerStub.calledWithNew()).to.be.true
            Sinon.assert.calledWith(wsHandlerStub, createWsConnectionStub, optionsStub)
        })

        it ('should create an Heartbeat with the right parameters', () => {
            // Testing
            optionsStub.heartbeat = Sinon.stub()
            stompWebSocketHandler(createWsConnectionStub, optionsStub)
            // verification
            expect(heartbeatStub.calledWithNew()).to.be.true
            Sinon.assert.calledWith(heartbeatStub, optionsStub.heartbeat)
        })

    })

    describe ('after calling default function ', () => {

        let tested
        let initConnectionSpy

        beforeEach (() => {
            tested = stompWebSocketHandler(createWsConnectionStub, optionsStub)
            initConnectionSpy = Sinon.spy(wsHandlerMock, 'initConnection')
        })

        it ('initConnection should call wsHandler.initConnection with the right parameters', () => {
            const headerParam = Sinon.stub()
            // Testing
            tested.initConnection(headerParam)
            // verification
            Sinon.assert.calledWith(initConnectionSpy, headerParam)
        })


    })

})

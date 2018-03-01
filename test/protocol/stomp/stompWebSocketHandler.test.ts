import { expect } from 'chai'
import * as Sinon from 'sinon'
import { Observable } from 'rxjs/Observable'
import { Subject } from 'rxjs/Subject';

import { BYTES } from '../../../src/utils';
import stompWebSocketHandler from '../../../src/protocol/stomp/stompWebSocketHandler'
import * as WebSocketHandler from '../../../src/webSocketHandler'
import * as Heartbeat from '../../../src/heartbeat'

describe ('stompWebSocketHandler', () => {

    let wsHandlerStub
    let heartbeatStub

    const createWsConnectionStub: any = Sinon.stub()
    const optionsStub: any = Sinon.stub()
    const initConnectionSubject = new Subject()

    const wsHandlerMock = {
        initConnection: (headers: any) => initConnectionSubject
    }

    const heartbeatMock = {
        startHeartbeat: Sinon.stub(),
        stopHeartbeat: Sinon.stub(),
        activityFromServer: Sinon.stub(),
        heartbeatSettings: Sinon.stub()
    }

    beforeEach (() => {
        wsHandlerStub = Sinon.stub(WebSocketHandler, 'default').returns(wsHandlerMock)
        heartbeatStub = Sinon.stub(Heartbeat, 'default').returns(heartbeatMock)
    })

    afterEach (() => {
        wsHandlerStub.resetHistory()
        wsHandlerStub.restore()
        heartbeatStub.resetHistory()
        heartbeatStub.restore()
        createWsConnectionStub.resetHistory()
        optionsStub.resetHistory()
        heartbeatMock.startHeartbeat.resetHistory()
        heartbeatMock.stopHeartbeat.resetHistory()
        heartbeatMock.activityFromServer.resetHistory()
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

    describe ('initConnection', () => {

        let tested
        let initConnectionSpy

        beforeEach (() => {
            tested = stompWebSocketHandler(createWsConnectionStub, optionsStub)
            initConnectionSpy = Sinon.spy(wsHandlerMock, 'initConnection')
        })

        it ('should call wsHandler.initConnection with the right parameters', () => {
            const headerParam = Sinon.stub()
            // Testing
            tested.initConnection(headerParam)
            // verification
            Sinon.assert.called(initConnectionSpy)
        })


    })

    describe ('when receiving a new connection', () => {

        let tested
        let cnSubscription
        const onCnNextStub = Sinon.stub()
        const onCnErrorStub = Sinon.stub()
        const onCnCompleteStub = Sinon.stub()

        beforeEach (() => {
            tested = stompWebSocketHandler(createWsConnectionStub, optionsStub)
            cnSubscription = tested.initConnection({}).subscribe(
                onCnNextStub,
                onCnErrorStub,
                onCnCompleteStub)
        })

        afterEach (() => {
            cnSubscription.unsubscribe()
            onCnNextStub.resetHistory()
            onCnErrorStub.resetHistory()
            onCnCompleteStub.resetHistory()
        })

        it ('should subscribe to messageReceived', () => {
            const messageReceivedSubject = new Subject()
            let messageReceivedSubjectSpy = Sinon.spy(messageReceivedSubject, 'subscribe')
            // test
            initConnectionSubject.next({messageReceived: messageReceivedSubject, messageSender: new Subject()})
            // verification
            Sinon.assert.calledOnce(messageReceivedSubjectSpy)
        })

        it ('should send CONNECT', () => {
            const messageSenderSubject = new Subject()
            let messageSenderSubjectSpy = Sinon.spy(messageSenderSubject, 'next')
            // test
            initConnectionSubject.next({messageReceived: new Subject(), messageSender: messageSenderSubject})
            // verification
            Sinon.assert.calledOnce(messageSenderSubjectSpy)
        })

        describe ('when CONNECTED received', () => {

            const expectedVersion = '1.2'
            const expectedHeartBeat = '100,1000'

            const CONNECTED_MSG = 'CONNECTED' + BYTES.LF +
                                  'version:' + expectedVersion + BYTES.LF +
                                  'heart-beat:' + expectedHeartBeat + BYTES.LF + BYTES.LF +
                                   BYTES.NULL

            let cnParams
            let messageReceivedSubject
            let messageSenderSubject

            beforeEach (() => {
                messageReceivedSubject = new Subject()
                messageSenderSubject = new Subject()
                initConnectionSubject.next({messageReceived: messageReceivedSubject, messageSender: messageSenderSubject})
                // test
                messageReceivedSubject.next({data: CONNECTED_MSG})
                cnParams = onCnNextStub.getCall(0).args[0]
            })

            it ('should give call next of onCnNextStub', () => {
                // verification
                Sinon.assert.calledOnce(onCnNextStub)
            })

            it ('should give back messageSenderSubject', () => {
                // verification
                expect(cnParams.messageSender).to.be.equal(messageSenderSubject)
            })

            it ('should call heartbeat startHeartbeat', () => {
                // verification
                Sinon.assert.calledOnce(heartbeatMock.startHeartbeat)
            })

            it ('should call heartbeat activityFromServer', () => {
                // verification
                Sinon.assert.calledOnce(heartbeatMock.activityFromServer)
            })

            describe ('heartbeat', () => {

                let heartbeatArgs

                beforeEach( () => {
                    heartbeatArgs = heartbeatMock.startHeartbeat.getCall(0).args
                })

                it ('should send heartbeatMsg on sendPing', () => {
                    let messageSenderSubjectSpy = Sinon.spy(messageSenderSubject, 'next')
                    // test
                    heartbeatArgs[2].sendPing()
                    // verification
                    Sinon.assert.calledOnce(messageSenderSubjectSpy)
                    Sinon.assert.calledWith(messageSenderSubjectSpy, BYTES.LF)
                })

                it ('should give back an error on close', () => {
                    // test
                    heartbeatArgs[2].close()
                    // verification
                    Sinon.assert.calledOnce(onCnErrorStub)
                })

            })

            describe ('when unsubscribe', () => {

                it ('should send DISCONNECT frame', () => {
                    let messageSenderSubjectSpy = Sinon.spy(messageSenderSubject, 'next')
                    // test
                    cnSubscription.unsubscribe()
                    // verification
                    Sinon.assert.calledOnce(messageSenderSubjectSpy)
                    Sinon.assert.calledWithMatch(messageSenderSubjectSpy, 'DISCONNECT')
                })

                it ('should stop heartbeat', () => {
                    // test
                    cnSubscription.unsubscribe()
                    // verification
                    Sinon.assert.calledOnce(heartbeatMock.stopHeartbeat)
                })

            })

            describe ('when RECEIPT received', () => {

                const RECEIPT_ID = '123'
                const RECEIPT_MSG = 'RECEIPT' + BYTES.LF +
                                      'receipt-id:' + RECEIPT_ID + BYTES.LF +
                                      BYTES.LF + BYTES.NULL

                let msgReceiptedSpy
                beforeEach ( () => {
                    msgReceiptedSpy = Sinon.spy(cnParams.messageReceipted, 'next')
                    // test
                    messageReceivedSubject.next({data: RECEIPT_MSG})
                })

                it ('should call cnParams.messageReceipted', () => {
                    const actualParams = msgReceiptedSpy.getCall(0).args
                    Sinon.assert.calledOnce(msgReceiptedSpy)
                    expect(actualParams[0].headers['receipt-id']).to.be.equal(RECEIPT_ID)
                })
            })

            describe ('when ERROR received', () => {

                const ERROR_ID = '123'
                const ERROR_MSG = 'ERROR' + BYTES.LF +
                                  'error-id:' + ERROR_ID + BYTES.LF +
                                   BYTES.LF + BYTES.NULL

                let errorReceivedSpy
                beforeEach ( () => {
                    errorReceivedSpy = Sinon.spy(cnParams.errorReceived, 'next')
                    // test
                    messageReceivedSubject.next({data: ERROR_MSG})
                })

                it ('should call cnParams.errorReceived', () => {
                    const actualParams = errorReceivedSpy.getCall(0).args
                    Sinon.assert.calledOnce(errorReceivedSpy)
                    expect(actualParams[0].headers['error-id']).to.be.equal(ERROR_ID)
                })
            })


            describe ('when MESSAGE received', () => {

                const TEXT_MSG = 'test msg'
                const DESTINATION = '/topic/webstompobs-typescript-chat-example'
                const SUBSCRIPTION = 'sub-0'
                const MESSAGE_ID = '15-2'
                const MESSAGE_MSG = 'MESSAGE' + BYTES.LF +
                                      'destination:' + DESTINATION + BYTES.LF +
                                      'subscription:' + SUBSCRIPTION + BYTES.LF +
                                      'message-id:' + MESSAGE_ID + BYTES.LF +
                                      'content-length:37' + BYTES.LF + BYTES.LF +
                                      '{"author":"User 1","text":"' + TEXT_MSG + '"}' + BYTES.NULL

                it ('should call subscriber if on the same destination', () => {
                    const messageReceivedStub = Sinon.stub()
                    cnParams.subscribeTo(DESTINATION).subscribe(messageReceivedStub)
                    // test
                    messageReceivedSubject.next({data: MESSAGE_MSG})
                    // verification
                    Sinon.assert.calledOnce(messageReceivedStub)
                    Sinon.assert.calledWithMatch(messageReceivedStub, {body: '{"author":"User 1","text":"test msg"}'})
                })

                it ('should not call subscriber if not on the same subscription', () => {
                    const messageReceivedStub = Sinon.stub()
                    cnParams.subscribeTo(DESTINATION).subscribe(() => 'NVM')
                    cnParams.subscribeTo(DESTINATION).subscribe(messageReceivedStub)
                    // test
                    messageReceivedSubject.next({data: MESSAGE_MSG})
                    // verification
                    Sinon.assert.notCalled(messageReceivedStub)
                })

                describe ('after unsubscribing', () => {

                    let messageReceivedStub
                    let subscription
                    beforeEach( () => {
                        messageReceivedStub = Sinon.stub()
                        subscription = cnParams.subscribeTo(DESTINATION).subscribe(messageReceivedStub)
                    })

                    it ('should send UNSUBSCRIBE', () => {
                        let messageSenderSubjectSpy = Sinon.spy(messageSenderSubject, 'next')
                        // test
                        subscription.unsubscribe()
                        // verification
                        Sinon.assert.calledOnce(messageSenderSubjectSpy)
                        Sinon.assert.calledWithMatch(messageSenderSubjectSpy, 'UNSUBSCRIBE')
                    })

                    it ('should stop send message', () => {
                        // test
                        subscription.unsubscribe()
                        messageReceivedSubject.next({data: MESSAGE_MSG})
                        // verification
                        Sinon.assert.notCalled(messageReceivedStub)
                    })
                })

            })

        })

    })


})

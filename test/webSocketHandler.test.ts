import { expect } from 'chai'
import * as Sinon from 'sinon'
import { Observable } from 'rxjs/Observable'
import WebSocketHandler from '../src/webSocketHandler'
import { BYTES, unicodeStringToTypedArray } from '../src/utils'
import Frame from '../src/frame'
import * as Heartbeat from '../src/heartbeat';

describe ('Stompobservable WebSocketHandler', () => {

    let tested: WebSocketHandler
    let createWsConnectionStub
    let wsStub
    let createHeartbeatStub
    const heartbeatMock = {
        startHeartbeat: Sinon.stub(),
        stopHeartbeat: Sinon.stub(),
        activityFromServer: Sinon.stub()
    }
    let options

    beforeEach ( () => {
        wsStub = Sinon.stub()
        createWsConnectionStub = Sinon.stub().returns(wsStub)
        createHeartbeatStub = Sinon.stub(Heartbeat, 'default').returns(heartbeatMock)
        options = Sinon.stub()
        tested = new WebSocketHandler(createWsConnectionStub, options)
    })

    afterEach ( () => {
        wsStub.reset()
        createWsConnectionStub.reset()
        heartbeatMock.startHeartbeat.reset()
        heartbeatMock.stopHeartbeat.reset()
        heartbeatMock.activityFromServer.reset()
        createHeartbeatStub.reset()
        createHeartbeatStub.restore()
        options.reset()
    })

    describe ('initConnection', () => {

        let actualConnectionObservable
        const mockedHeaders = {host: 'an host', 'accept-version': '1.2,1.1,1.0', login: 'a login'}
        const expectedHeaders = { 'heart-beat': "10000,10000", ...mockedHeaders}

        it ('should return an observable', () => {
            actualConnectionObservable = tested.initConnection(mockedHeaders)
            expect(actualConnectionObservable).to.exist
            expect(actualConnectionObservable).to.be.instanceof(Observable)
        })

        describe ('on subscribe', () => {

            let msgReceivedSpy
            let msgErrorSpy
            let msgCompleteSpy
            let subscription

            beforeEach ( () => {
                msgReceivedSpy = Sinon.spy()
                msgErrorSpy = Sinon.spy()
                msgCompleteSpy = Sinon.spy()
                actualConnectionObservable = tested.initConnection(mockedHeaders)
                subscription = actualConnectionObservable.subscribe(
                    (frame) => msgReceivedSpy(frame),
                    (err) => msgErrorSpy(err),
                    () => msgCompleteSpy())
            })

            afterEach ( () => {
                msgReceivedSpy.reset()
                msgErrorSpy.reset()
                msgCompleteSpy.reset()
            })

            it ('should call createWsConnectionStub', () => {
                Sinon.assert.calledOnce(createWsConnectionStub)
            })

            it ('should set ws.binaryType to arraybuffer', () => {
                expect(wsStub.binaryType).to.eql('arraybuffer')
            })

            it ('should set ws.onmessage to be a function', () => {
                expect(wsStub.onmessage).to.be.instanceof(Function)
            })

            it ('should set ws.onclose to be a function', () => {
                expect(wsStub.onclose).to.be.instanceof(Function)
            })

            it ('should set ws.onopen to be a function', () => {
                expect(wsStub.onopen).to.be.instanceof(Function)
            })

            it ('when receiving a message should call heartbeatMock.activityFromServer', () => {
                wsStub.onmessage({data: 'whatever message'})
                Sinon.assert.calledOnce(heartbeatMock.activityFromServer)
            })

            describe ('when CONNECTED received', () => {

                const expectedVersion = '1.2'
                const expectedHeartBeat = '100,1000'

                const CONNECTED_MSG = 'CONNECTED' + BYTES.LF +
                                      'version:' + expectedVersion + BYTES.LF +
                                      'heart-beat:' + expectedHeartBeat + BYTES.LF + BYTES.LF +
                                      BYTES.NULL

                let sendStub
                beforeEach ( () => {
                    sendStub = Sinon.stub(tested, <any>'_wsSend')
                    wsStub.close = Sinon.stub()
                    wsStub.onmessage({data: CONNECTED_MSG})
                })

                afterEach ( () => {
                    sendStub.reset()
                    sendStub.restore()
                    wsStub.close.reset()
                })

                it ('should call observer.next', () => {
                    Sinon.assert.calledOnce(msgReceivedSpy)
                })

                describe ('heartbeatMock.startHeartbeat', () => {

                    let callbackParams

                    beforeEach ( () => {
                        callbackParams = heartbeatMock.startHeartbeat.getCall(0).args[1]
                    })

                    it ('should be called', () => {
                        Sinon.assert.calledOnce(heartbeatMock.startHeartbeat)
                    })

                    it ('should contain headers', () => {
                        Sinon.assert.calledWith(heartbeatMock.startHeartbeat,
                                                { "heart-beat": expectedHeartBeat, version: expectedVersion })
                    })

                    it ('should contain a send callback', () => {
                        const { send } = callbackParams;
                        const expectedData = 'A data';
                        send(expectedData);

                        Sinon.assert.calledOnce(sendStub)
                        Sinon.assert.calledWith(sendStub, wsStub, expectedData)
                    })

                    it ('should contain a close callback', () => {
                        const { close } = callbackParams;
                        close();

                        Sinon.assert.calledOnce(wsStub.close)
                    })

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
                                      '{"author":"User 1","text":"' + TEXT_MSG + '"}' +
                                      BYTES.NULL

                let onSubscriptionMsgReceivedSpy

                beforeEach ( () => {
                    onSubscriptionMsgReceivedSpy = Sinon.spy((<any>tested).messageReceivedObservable, 'next')
                })

                afterEach ( () => {
                    onSubscriptionMsgReceivedSpy.reset()
                })

                it ('should call tested.messageReceivedObservable', () => {
                    wsStub.onmessage({data: MESSAGE_MSG})

                    Sinon.assert.calledOnce(onSubscriptionMsgReceivedSpy)
                    Sinon.assert.calledWithMatch(onSubscriptionMsgReceivedSpy, {body: '{"author":"User 1","text":"test msg"}'})
                })

                describe ('the parameters', () => {

                    let actualParams
                    let testedAckStub
                    let testedNackStub
                    beforeEach ( () => {
                        testedAckStub = Sinon.stub(tested, 'ack')
                        testedNackStub = Sinon.stub(tested, 'nack')

                        wsStub.onmessage({data: MESSAGE_MSG})
                        actualParams = onSubscriptionMsgReceivedSpy.getCall(0).args
                    })

                    afterEach ( () => {
                        testedAckStub.reset()
                        testedAckStub.restore()
                        testedNackStub.reset()
                        testedNackStub.restore()
                    })

                    it ('should have the right destination', () => {
                        expect(actualParams[0].headers.destination).to.equal(DESTINATION)
                    })

                    it ('should have the right body', () => {
                        expect(actualParams[0].body).to.equal('{"author":"User 1","text":"' + TEXT_MSG + '"}')
                    })

                    describe ('ack', () => {

                        it ('should be a function', () => {
                            expect(actualParams[0].ack).to.be.instanceof(Function)
                        })

                        it ('should call tested.ack', () => {
                            actualParams[0].ack()
                            Sinon.assert.calledOnce(testedAckStub)
                            Sinon.assert.calledWith(testedAckStub, MESSAGE_ID, SUBSCRIPTION)
                        })

                    })

                    describe ('nack', () => {

                        it ('should be a function', () => {
                            expect(actualParams[0].nack).to.be.instanceof(Function)
                        })

                        it ('should call tested.ack', () => {
                            actualParams[0].nack()
                            Sinon.assert.calledOnce(testedNackStub)
                            Sinon.assert.calledWith(testedNackStub, MESSAGE_ID, SUBSCRIPTION)
                        })

                    })

                })

            })

            describe ('when RECEIPT received', () => {

                const RECEIPT_ID = '123'
                const RECEIPT_MSG = 'RECEIPT' + BYTES.LF +
                                      'receipt-id:' + RECEIPT_ID + BYTES.LF +
                                      BYTES.LF + BYTES.NULL

                let testedReceiptedSpy
                beforeEach ( () => {
                    testedReceiptedSpy = Sinon.spy(tested.messageReceiptedObservable, 'next')

                    wsStub.onmessage({data: RECEIPT_MSG})
                })

                it ('should call tested.onMessageReceipted', () => {
                    const actualParams = testedReceiptedSpy.getCall(0).args
                    Sinon.assert.calledOnce(testedReceiptedSpy)
                    expect(actualParams[0].headers['receipt-id']).to.be.equal(RECEIPT_ID)
                })
            })

            describe ('when ERROR received', () => {

                const ERROR_ID = '123'
                const ERROR_MSG = 'ERROR' + BYTES.LF +
                                      'error-id:' + ERROR_ID + BYTES.LF +
                                      BYTES.LF + BYTES.NULL

                let testedErrorSpy
                beforeEach ( () => {
                    testedErrorSpy = Sinon.spy(tested.errorReceivedObservable, 'next')

                    wsStub.onmessage({data: ERROR_MSG})
                })

                it ('should call tested.onMessageReceipted', () => {
                    Sinon.assert.calledOnce(testedErrorSpy)
                    const actualParams = testedErrorSpy.getCall(0).args
                    expect(actualParams[0].headers['error-id']).to.be.equal(ERROR_ID)
                })
            })

            describe ('when ws.onclose is called', () => {

                const fakeEvt = {test: 1}
                let testedConnectionErrorSpy
                beforeEach ( () => {
                    testedConnectionErrorSpy = Sinon.spy(tested.connectionErrorObservable, "next")
                    wsStub.onclose(fakeEvt)
                })

                it ('should call heartbeatMock.stopHeartbeat', () => {
                    Sinon.assert.calledTwice(heartbeatMock.stopHeartbeat)
                })
            })

            describe ('when unsubscribe', () => {

                let disconnectStub
                beforeEach ( () => {
                    disconnectStub = Sinon.stub(tested, 'disconnect')
                })

                afterEach ( () => {
                    disconnectStub.reset()
                    disconnectStub.restore()
                })

                it ('should call tested.disconnect', () => {
                    subscription.unsubscribe()

                    Sinon.assert.calledOnce(disconnectStub)
                })

            })

            describe ('tested._transmit', () => {

                const maxWebSocketFrameSize = 16 * 1024
                let transmitWsStub
                const shortData = 'any data that is very lohng\n so it has to be \n sent in multiple message'

                beforeEach ( () => {
                    transmitWsStub = Sinon.stub()
                    transmitWsStub.send = Sinon.stub()
                })

                afterEach ( () => {
                    transmitWsStub.send.reset()
                    transmitWsStub.reset()
                })

                it ('should call tested._wsSend', () => {
                    (tested as any)._wsSend(transmitWsStub, shortData)

                    Sinon.assert.calledOnce(transmitWsStub.send)
                    Sinon.assert.calledWith(transmitWsStub.send, shortData)
                })

                it ('should call tested._wsSend multiple times', () => {
                    let veryLongData = ''
                    for(let i=0; i<300; i++) { veryLongData += shortData};
                    (tested as any)._wsSend(transmitWsStub, veryLongData)

                    Sinon.assert.calledTwice(transmitWsStub.send)
                    Sinon.assert.calledWith(transmitWsStub.send, veryLongData.slice(0, maxWebSocketFrameSize))
                    Sinon.assert.calledWith(transmitWsStub.send, veryLongData.slice(maxWebSocketFrameSize))
                })

            })

            describe ('tested._wsSend', () => {

                const command = 'A COMMAND'
                const headers = Sinon.stub()
                const body = {msg: 'A BODY'}
                const expectedMarshalled = Sinon.stub()
                let sendStub
                let marshallStub

                beforeEach ( () => {
                    marshallStub = Sinon.stub(Frame, 'marshall')
                    marshallStub.withArgs(command, headers, body).returns(expectedMarshalled)
                    sendStub = Sinon.stub(tested, <any>'_wsSend')
                })

                afterEach ( () => {
                    marshallStub.reset()
                    marshallStub.restore()
                    sendStub.reset()
                    sendStub.restore()
                })

                it ('should call tested._wsSend', () => {
                    (tested as any)._transmit(command, headers, body)

                    Sinon.assert.calledOnce(sendStub)
                    Sinon.assert.calledWith(sendStub, wsStub, expectedMarshalled)
                })

            })

            describe ('transmit', () => {

                const expectedHeader = {test: 'An header'}
                const expectedBody = 'A BODY'

                let transmitStub
                beforeEach ( () => {
                    transmitStub = Sinon.stub(tested, <any>'_transmit')
                })

                afterEach ( () => {
                    transmitStub.reset()
                    transmitStub.restore()
                })


                describe ('when ws.onopen is called', () => {

                    it ('should call ws.send with a connect message', () => {
                        wsStub.onopen()

                        Sinon.assert.calledOnce(transmitStub)
                        Sinon.assert.calledWith(transmitStub, 'CONNECT', expectedHeaders)
                    })

                })

                describe ('disconnect', () => {

                    let onCloseSpy
                    beforeEach ( () => {
                        wsStub.close = Sinon.stub()
                        onCloseSpy = Sinon.spy(wsStub, 'onclose')

                        tested["connected"] = true // we force the flag connected
                        tested.disconnect()
                    })

                    afterEach ( () => {
                        wsStub.close.reset()
                        onCloseSpy.reset()
                    })

                    it('should not call ws.onclose', () => {
                        Sinon.assert.notCalled(onCloseSpy)
                    })

                    it('should call ws.send', () => {
                        Sinon.assert.calledOnce(transmitStub)
                        Sinon.assert.calledWith(transmitStub, 'DISCONNECT')
                    })

                    it('should call ws.close', () => {
                        Sinon.assert.calledOnce(wsStub.close)
                    })

                    it ('should call heartbeatMock.stopHeartbeat', () => {
                        Sinon.assert.calledOnce(heartbeatMock.stopHeartbeat)
                    })

                })

                describe ('send', () => {

                    it('should call tested._transmit', () => {
                        tested.send(expectedHeader, expectedBody)

                        Sinon.assert.calledOnce(transmitStub)
                        Sinon.assert.calledWith(transmitStub, 'SEND', expectedHeader, expectedBody)
                    })

                })

                describe ('commit', () => {
                    const expectedTransaction = 'The transaction'

                    it('should call tested._transmit', () => {
                        tested.commit(expectedTransaction)

                        Sinon.assert.calledOnce(transmitStub)
                        Sinon.assert.calledWith(transmitStub, 'COMMIT', {transaction: expectedTransaction})
                    })

                })

                describe ('abort', () => {
                    const expectedTransaction = 'The transaction'

                    it('should call tested._transmit', () => {
                        tested.abort(expectedTransaction)

                        Sinon.assert.calledOnce(transmitStub)
                        Sinon.assert.calledWith(transmitStub, 'ABORT', {transaction: expectedTransaction})
                    })

                })

                describe ('', () => {

                    const messageID = 'An id'
                    const subscription = 'A subscription'
                    const expectedParam = {'message-id': messageID, subscription}

                    it('ack should call tested._transmit', () => {
                        tested.ack(messageID, subscription)

                        Sinon.assert.calledOnce(transmitStub)
                        Sinon.assert.calledWith(transmitStub, 'ACK', expectedParam)
                    })

                    it('nack should call tested._transmit', () => {
                        tested.nack(messageID, subscription)

                        Sinon.assert.calledOnce(transmitStub)
                        Sinon.assert.calledWith(transmitStub, 'NACK', expectedParam)
                    })

                })

                describe ('begin', () => {

                    it('should call tested._transmit', () => {
                        tested.begin()

                        Sinon.assert.calledOnce(transmitStub)
                        Sinon.assert.calledWith(transmitStub, 'BEGIN', {transaction:'tx-0'})
                    })

                    it('should call tested._transmit with transaction', () => {
                        const expectedTransaction = 'A TRANSACTION'
                        tested.begin(expectedTransaction)

                        Sinon.assert.calledOnce(transmitStub)
                        Sinon.assert.calledWith(transmitStub, 'BEGIN', {transaction:expectedTransaction})
                    })

                    describe ('should give back', () => {

                        let actual
                        let commitStub
                        let abortStub

                        beforeEach ( () => {
                            commitStub = Sinon.stub(tested, 'commit')
                            abortStub = Sinon.stub(tested, 'abort')

                            actual = tested.begin()
                        })

                        afterEach ( () => {
                            commitStub.reset()
                            commitStub.restore()
                            abortStub.reset()
                            abortStub.restore()
                        })

                        it('id of the transaction', () => {
                            expect(actual.id).to.equal('tx-0')
                        })

                        it('commit callback', () => {
                            expect(actual.commit).to.be.instanceof(Function)
                            actual.commit()
                            Sinon.assert.calledOnce(commitStub)
                            Sinon.assert.notCalled(abortStub)
                        })

                        it('abort callback', () => {
                            expect(actual.abort).to.be.instanceof(Function)
                            actual.abort()
                            Sinon.assert.calledOnce(abortStub)
                            Sinon.assert.notCalled(commitStub)
                        })

                    })

                })

                describe ('subscribe', () => {

                    const subscribeHeader = { destination: 'A destination', id: '123'}

                    it('should call tested._transmit with transaction', () => {
                        tested.subscribe(subscribeHeader)

                        Sinon.assert.calledOnce(transmitStub)
                        Sinon.assert.calledWith(transmitStub, 'SUBSCRIBE', subscribeHeader)
                    })

                    describe ('should give back', () => {

                        const expectedId = '123'
                        let actual
                        let unSubscribeStub

                        beforeEach ( () => {
                            unSubscribeStub = Sinon.stub(tested, 'unSubscribe')

                            actual = tested.subscribe(subscribeHeader).subscribe()
                        })

                        afterEach ( () => {
                            unSubscribeStub.reset()
                            unSubscribeStub.restore()
                        })

                        it('unsubscribe callback', () => {
                            expect(actual.unsubscribe).to.be.instanceof(Function)
                            actual.unsubscribe()
                            Sinon.assert.calledOnce(unSubscribeStub)
                            Sinon.assert.calledWith(unSubscribeStub, {id: subscribeHeader.id})
                        })

                    })

                })

                describe ('unSubscribe', () => {

                    it('should call tested._transmit', () => {
                        const unsubscribeHeader = {id: '123'}
                        tested.unSubscribe(unsubscribeHeader)

                        Sinon.assert.calledOnce(transmitStub)
                        Sinon.assert.calledWith(transmitStub, 'UNSUBSCRIBE', unsubscribeHeader)
                    })

                })

            })

        })

    })

});

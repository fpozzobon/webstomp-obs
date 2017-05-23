import { expect } from 'chai'
import * as Sinon from 'sinon'
import { Observable } from 'rxjs/Observable'
import WebSocketHandler from '../src/webSocketHandler'
import { BYTES, unicodeStringToTypedArray } from '../src/utils'
import Frame from '../src/frame'

describe ('Stompobservable WebSocketHandler', () => {

    let tested: WebSocketHandler
    let createWsConnectionSpy
    let wsStub
    let options

    beforeEach ( () => {
        wsStub = Sinon.stub()
        createWsConnectionSpy = Sinon.stub().returns(wsStub)
        options = Sinon.stub()
        tested = new WebSocketHandler(createWsConnectionSpy, options)
    })

    afterEach ( () => {
        wsStub.reset()
        createWsConnectionSpy.reset()
        options.reset()
    })

    describe ('initConnection', () => {

        let actualConnectionObservable
        const mockedHeaders = {test: 1}
        const expectedHeaders = { 'accept-version': "1.2,1.1,1.0", 'heart-beat': "10000,10000", ...mockedHeaders}
        let onDisconnectedSpy = Sinon.spy()

        beforeEach ( () => {
            onDisconnectedSpy = Sinon.spy()
        })

        afterEach ( () => {
            onDisconnectedSpy.reset()
        })

        it ('should return an observable', () => {
            actualConnectionObservable = tested.initConnection(mockedHeaders, onDisconnectedSpy)
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
                actualConnectionObservable = tested.initConnection(mockedHeaders, onDisconnectedSpy)
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

            it ('should call createWsConnectionSpy', () => {
                Sinon.assert.calledOnce(createWsConnectionSpy)
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

            describe ('when CONNECTED received', () => {

                const CONNECTED_MSG = 'CONNECTED' + BYTES.LF +
                                      'version:1.2' + BYTES.LF +
                                      'heart-beat:0,0' + BYTES.LF + BYTES.LF +
                                      BYTES.NULL

                beforeEach ( () => {
                    wsStub.onmessage({data: CONNECTED_MSG})
                })

                it ('should call observer.next', () => {
                    Sinon.assert.calledOnce(msgReceivedSpy)
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

                let onSubscriptionMsgReceivedSpy = Sinon.spy()
                let onMsgReceivedSpy = Sinon.spy()
                
                beforeEach ( () => {
                    tested.onMessageReceived = (subscription: string): (Frame) => void => {
                        onSubscriptionMsgReceivedSpy(subscription)
                        return onMsgReceivedSpy
                    }
                })

                afterEach ( () => {
                    onSubscriptionMsgReceivedSpy.reset()
                    onMsgReceivedSpy.reset()
                })

                it ('should call tested.onMessageReceived', () => {
                    wsStub.onmessage({data: MESSAGE_MSG})

                    Sinon.assert.calledOnce(onSubscriptionMsgReceivedSpy)
                    Sinon.assert.calledWith(onSubscriptionMsgReceivedSpy, SUBSCRIPTION)
                    Sinon.assert.calledOnce(onMsgReceivedSpy)
                })

                describe ('the parameters', () => {

                    let actualParams                             
                    let testedAckStub
                    let testedNackStub           
                    beforeEach ( () => {
                        testedAckStub = Sinon.stub(tested, 'ack')
                        testedNackStub = Sinon.stub(tested, 'nack')
                        
                        wsStub.onmessage({data: MESSAGE_MSG})
                        actualParams = onMsgReceivedSpy.getCall(0).args
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
                
                let testedReceiptedStub
                beforeEach ( () => {
                    testedReceiptedStub = Sinon.stub()
                    tested.onMessageReceipted = () => testedReceiptedStub

                    wsStub.onmessage({data: RECEIPT_MSG})
                })

                it ('should call tested.onMessageReceipted', () => {
                    const actualParams = testedReceiptedStub.getCall(0).args
                    Sinon.assert.calledOnce(testedReceiptedStub)
                    expect(actualParams[0].headers['receipt-id']).to.be.equal(RECEIPT_ID)
                })
            })

            describe ('when ERROR received', () => {

                const ERROR_ID = '123'
                const ERROR_MSG = 'ERROR' + BYTES.LF +
                                      'error-id:' + ERROR_ID + BYTES.LF + 
                                      BYTES.LF + BYTES.NULL
                
                let testedErrorStub
                beforeEach ( () => {
                    testedErrorStub = Sinon.stub()
                    tested.onErrorReceived = () => testedErrorStub

                    wsStub.onmessage({data: ERROR_MSG})
                })

                it ('should call tested.onMessageReceipted', () => {
                    Sinon.assert.calledOnce(testedErrorStub)
                    const actualParams = testedErrorStub.getCall(0).args
                    expect(actualParams[0].headers['error-id']).to.be.equal(ERROR_ID)
                })
            })

            describe ('when ws.onclose is called', () => {
                
                const fakeEvt = {test: 1}
                let testedConnectionErrorStub
                beforeEach ( () => {
                    testedConnectionErrorStub = Sinon.stub()
                    tested.onConnectionError = () => testedConnectionErrorStub

                    wsStub.onclose(fakeEvt)
                })

                it ('should call tested.onMessageReceipted', () => {
                    Sinon.assert.calledOnce(testedConnectionErrorStub)
                    Sinon.assert.calledWith(testedConnectionErrorStub, fakeEvt)
                })
                
                it ('should call onDisconnect callback', () => {
                    Sinon.assert.calledOnce(onDisconnectedSpy)
                    Sinon.assert.calledWith(onDisconnectedSpy, fakeEvt)
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
                    Sinon.assert.calledWith(disconnectStub, mockedHeaders)
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
                    sendStub = Sinon.stub(tested, '_wsSend')
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
                    transmitStub = Sinon.stub(tested, '_transmit')
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
                    const headers = {testHeader: 1}
                    const expectedParam = {...headers, 'message-id': messageID, subscription}

                    it('ack should call tested._transmit', () => {
                        tested.ack(messageID, subscription, headers)

                        Sinon.assert.calledOnce(transmitStub)
                        Sinon.assert.calledWith(transmitStub, 'ACK', expectedParam)
                    })

                    it('nack should call tested._transmit', () => {
                        tested.nack(messageID, subscription, headers)

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

                    it('should call tested._transmit', () => {
                        tested.subscribe()

                        Sinon.assert.calledOnce(transmitStub)
                        Sinon.assert.calledWith(transmitStub, 'SUBSCRIBE', {})
                    })

                    it('should call tested._transmit with transaction', () => {
                        tested.subscribe(mockedHeaders)

                        Sinon.assert.calledOnce(transmitStub)
                        Sinon.assert.calledWith(transmitStub, 'SUBSCRIBE', mockedHeaders)
                    })

                    describe ('should give back', () => {

                        const expectedId = 123
                        let actual
                        let unSubscribeStub

                        beforeEach ( () => {
                            unSubscribeStub = Sinon.stub(tested, 'unSubscribe')

                            actual = tested.subscribe({id: expectedId})
                        })

                        afterEach ( () => {
                            unSubscribeStub.reset()
                            unSubscribeStub.restore()
                        })

                        it('id of the header', () => {
                            expect(actual.id).to.equal(expectedId)
                        })

                        it('unsubscribe callback', () => {
                            expect(actual.unsubscribe).to.be.instanceof(Function)
                            actual.unsubscribe()
                            Sinon.assert.calledOnce(unSubscribeStub)
                            Sinon.assert.calledWith(unSubscribeStub, expectedId)
                        })

                    })

                })

                describe ('unSubscribe', () => {

                    it('should call tested._transmit', () => {
                        tested.unSubscribe(mockedHeaders)

                        Sinon.assert.calledOnce(transmitStub)
                        Sinon.assert.calledWith(transmitStub, 'UNSUBSCRIBE', mockedHeaders)
                    })

                })

            })

        })

    })

});
import { expect } from 'chai'
import * as Sinon from 'sinon'
import { Observable } from 'rxjs/Observable'
import WebSocketHandler from '../src/webSocketHandler'
import { BYTES, unicodeStringToTypedArray } from '../src/utils'
import Frame from '../src/frame'

describe ('Stompobservable WebSocketHandler', () => {

    let tested: WebSocketHandler
    let createWsConnectionStub
    let wsStub
    let options

    beforeEach ( () => {
        wsStub = Sinon.stub()
        createWsConnectionStub = Sinon.stub().returns(wsStub)
        options = Sinon.stub()
        tested = new WebSocketHandler(createWsConnectionStub, options)
    })

    afterEach ( () => {
        wsStub.resetHistory()
        createWsConnectionStub.resetHistory()
        options.resetHistory()
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

            let connectionSpy
            let msgReceivedSpy
            let msgErrorSpy
            let msgCompleteSpy
            let subscription

            beforeEach ( () => {
                connectionSpy = Sinon.spy()
                msgReceivedSpy = Sinon.spy()
                msgErrorSpy = Sinon.spy()
                msgCompleteSpy = Sinon.spy()
                actualConnectionObservable = tested.initConnection(mockedHeaders)
                subscription = actualConnectionObservable.subscribe(
                    ({messageReceived, messageSender}) => {
                        connectionSpy({messageReceived, messageSender})
                        messageReceived.subscribe((frame) => msgReceivedSpy(frame))
                    },
                    (err) => msgErrorSpy(err),
                    () => msgCompleteSpy())
            })

            afterEach ( () => {
                connectionSpy.resetHistory()
                msgReceivedSpy.resetHistory()
                msgErrorSpy.resetHistory()
                msgCompleteSpy.resetHistory()
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

            describe ('when message received', () => {

                let sendStub
                beforeEach ( () => {
                    sendStub = Sinon.stub(tested, <any>'_wsSend')
                    wsStub.close = Sinon.stub()
                    wsStub.onopen()
                    wsStub.onmessage({data: 'A MESSAGE'})
                })

                afterEach ( () => {
                    sendStub.resetHistory()
                    sendStub.restore()
                    wsStub.close.resetHistory()
                })

                it ('should call observer.next', () => {
                    Sinon.assert.calledOnce(connectionSpy)
                    Sinon.assert.calledOnce(msgReceivedSpy)
                })

            })

            describe ('when unsubscribe', () => {

                let disconnectStub
                beforeEach ( () => {
                    disconnectStub = Sinon.stub(tested, 'disconnect')
                })

                afterEach ( () => {
                    disconnectStub.resetHistory()
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
                    transmitWsStub.send.resetHistory()
                    transmitWsStub.resetHistory()
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

        })

    })

});

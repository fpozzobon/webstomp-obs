import { expect } from 'chai'
import * as Sinon from 'sinon'
import { ConnectedClient } from '../src/connectedClient'
import { IConnectedObservable } from '../src/types'
import { Observable } from 'rxjs/Observable'
import { Subject } from 'rxjs/Subject';

describe ('Stompobservable connectedClient', () => {
    let client: ConnectedClient
    const fakeTransaction = 'A transaction'
    let mockedConnection
    const messageReceivedSubject = new Subject()

    beforeEach( () => {
        mockedConnection = {
            messageSender: new Subject(),
            protocol: {} as any,
            messageReceipted: new Subject(),
            errorReceived: new Subject(),
            subscribeTo: (destination: string, headers: any) => messageReceivedSubject
        }

        client = new ConnectedClient(mockedConnection)
    })

    describe ('send', () => {

        let msgSenderSpy
        let protocolSendStub

        beforeEach ( () => {
            msgSenderSpy = Sinon.spy(mockedConnection.messageSender, 'next')
            protocolSendStub = Sinon.stub()
            mockedConnection.protocol.send = protocolSendStub
        })

        afterEach ( () => {
            msgSenderSpy.reset()
        })

        it ('should call webSocketClient.send with the right parameters', () => {
            const expectedDestination = "A destination"
            const expectedBody = "A body"
            client.send(expectedDestination, expectedBody)

            Sinon.assert.calledOnce(msgSenderSpy)
            Sinon.assert.calledOnce(protocolSendStub)
            const actualParams = protocolSendStub.getCall(0).args
            expect(actualParams[0].destination).to.equal(expectedDestination)
            expect(actualParams[1]).to.equal(expectedBody)

        })

        it ('should call webSocketClient.send with the expected header with destination inside', () => {
            const expectedDestination = "A destination"
            client.send(expectedDestination, "A body")

            Sinon.assert.calledOnce(msgSenderSpy)
            Sinon.assert.calledOnce(protocolSendStub)
            const actualParams = protocolSendStub.getCall(0).args
            expect(actualParams[0]).to.eql({destination: expectedDestination})

        })

    })

    describe ('begin', () => {

        let protocolBeginStub

        beforeEach ( () => {
            protocolBeginStub = Sinon.stub()
            mockedConnection.protocol.begin = protocolBeginStub
        })

        afterEach ( () => {
            protocolBeginStub.reset()
        })

        it ('should call webSocketClient.begin with undefined transaction', () => {
            client.begin()
            Sinon.assert.calledOnce(protocolBeginStub)
            Sinon.assert.calledWith(protocolBeginStub, undefined)
        })

        it ('should call webSocketClient.begin with the right parameters', () => {
            client.begin(fakeTransaction)

            Sinon.assert.calledOnce(protocolBeginStub)
            Sinon.assert.calledWith(protocolBeginStub, fakeTransaction)
        })
    })

    describe ('commit', () => {

        let protocolCommitStub

        beforeEach ( () => {
            protocolCommitStub = Sinon.stub()
            mockedConnection.protocol.commit = protocolCommitStub
        })

        afterEach ( () => {
            protocolCommitStub.reset()
        })

        it ('should call webSocketClient.commit with transaction', () => {
            client.commit(fakeTransaction)

            Sinon.assert.calledOnce(protocolCommitStub)
            Sinon.assert.calledWith(protocolCommitStub, fakeTransaction)
        })
    })

    describe ('abort', () => {

        let protocolAbortStub

        beforeEach ( () => {
            protocolAbortStub = Sinon.stub()
            mockedConnection.protocol.abort = protocolAbortStub
        })

        afterEach ( () => {
            protocolAbortStub.reset()
        })

        it ('should call webSocketClient.abort with transaction', () => {
            client.abort(fakeTransaction)

            Sinon.assert.calledOnce(protocolAbortStub)
            Sinon.assert.calledWith(protocolAbortStub, fakeTransaction)
        })
    })

    describe ('ack', () => {

        let protocolAckStub

        beforeEach ( () => {
            protocolAckStub = Sinon.stub()
            mockedConnection.protocol.ack = protocolAckStub
        })

        afterEach ( () => {
            protocolAckStub.reset()
        })

        it ('should call webSocketClient.ack with transaction', () => {
            const expectedMessageID = "A message Id"
            const expectedSubscription = "A Subscription"
            client.ack(expectedMessageID, expectedSubscription)

            Sinon.assert.calledOnce(protocolAckStub)
            Sinon.assert.calledWith(protocolAckStub, expectedMessageID, expectedSubscription)
        })
    })

    describe ('nack', () => {

        let protocolNackStub

        beforeEach ( () => {
            protocolNackStub = Sinon.stub()
            mockedConnection.protocol.nack = protocolNackStub
        })

        afterEach ( () => {
            protocolNackStub.reset()
        })

        it ('should call webSocketHandler.nack with transaction', () => {
            const expectedMessageID = "A message Id"
            const expectedSubscription = "A Subscription"
            client.nack(expectedMessageID, expectedSubscription)

            Sinon.assert.calledOnce(protocolNackStub)
            Sinon.assert.calledWith(protocolNackStub, expectedMessageID, expectedSubscription)
        })
    })

    describe ('receipt', () => {

        it ('should give back an observable', () => {
            const actualReceiptObservable = client.receipt()

            expect(actualReceiptObservable).to.exist
            expect(actualReceiptObservable).to.be.instanceof(Observable)
        })

        it ('should not create a new observable', () => {
            const actualReceiptObservable = client.receipt()
            const otherReceiptObservable = client.receipt()

            expect(otherReceiptObservable).to.equal(actualReceiptObservable)
        })

        it ('should give back the frame to the subscribers when webSocketClient.messageReceiptedObservable is called', (done) => {
            const expectedFrame = Sinon.stub()
            client.receipt().subscribe(
                (frame) => {
                    expect(frame).to.equal(expectedFrame)
                    done()
                },
                (err) => done("unexpected " + err),
                () => done("unexpected")
            )
            mockedConnection.messageReceipted.next(expectedFrame)
        })

    })

    describe ('error', () => {

        it ('should give back an observable', () => {
            const actualReceiptObservable = client.error()

            expect(actualReceiptObservable).to.exist
            expect(actualReceiptObservable).to.be.instanceof(Observable)
        })

        it ('should not create a new observable', () => {
            const actualReceiptObservable = client.error()
            const otherReceiptObservable = client.error()

            expect(otherReceiptObservable).to.equal(actualReceiptObservable)
        })

        it ('should give back the error to the subscribers when webSocketClient.errorReceivedObservable is called', (done) => {
            const expectedError = Sinon.stub()
            client.error().subscribe(
                (error) => {
                    expect(error).to.equal(expectedError)
                    done()
                },
                (err) => done("unexpected " + err),
                () => done("unexpected")
            )
            mockedConnection.errorReceived.next(expectedError)
        })

    })

    describe ('connectionError', () => {

        it ('should give back an observable', () => {
            const actualReceiptObservable = client.connectionError()

            expect(actualReceiptObservable).to.exist
            expect(actualReceiptObservable).to.be.instanceof(Observable)
        })

        it ('should not create a new observable', () => {
            const actualReceiptObservable = client.connectionError()
            const otherReceiptObservable = client.connectionError()

            expect(otherReceiptObservable).to.equal(actualReceiptObservable)
        })

        it ('should give back the connectionError to the subscribers when webSocketClient.connectionErrorObservable is called', (done) => {
            const expectedError = Sinon.stub()
            client.connectionError().subscribe(
                (error) => {
                    expect(error).to.equal(expectedError)
                    done()
                },
                (err) => done("unexpected " + err),
                () => done("unexpected")
            )
            mockedConnection.errorReceived.next(expectedError)
        })

    })

    describe ('subscribe', () => {

        let subscribeStub

        beforeEach ( () => {
            subscribeStub = Sinon.stub(mockedConnection, 'subscribeTo')
        })

        afterEach ( () => {
            subscribeStub.reset()
        })

        it ('should give back an observable and call webSocketClient.subscribe with the right parameters', () => {
            subscribeStub.returns(messageReceivedSubject)
            const expectedDestination = "A destination"
            const actualReceiptObservable = client.subscribe(expectedDestination)

            expect(actualReceiptObservable).to.exist
            expect(actualReceiptObservable).to.equal(messageReceivedSubject)
        })

        it ('should give back a unique observable', () => {
            subscribeStub.onFirstCall().returns(new Subject())
            subscribeStub.onSecondCall().returns(new Subject())
            const actualReceiptObservable = client.subscribe("A destination")
            const otherReceiptObservable = client.subscribe("A destination")

            expect(otherReceiptObservable).to.not.equal(actualReceiptObservable)
        })

        it ('should call webSocketClient.subscribe with the right parameters', (done) => {
            subscribeStub.returns(new Subject())
            const expectedDestination = "A destination"
            const expectedHeader = {id: 'sub-0'}
            client.subscribe(expectedDestination, expectedHeader)
                  .subscribe(
                    (frame) => done(frame),
                    (err) => done("unexpected " + err),
                    () => done("unexpected")
                )
            const actualParams = subscribeStub.getCall(0).args
            Sinon.assert.calledOnce(subscribeStub)
            expect(actualParams[0]).to.equal(expectedDestination)
            expect(actualParams[1]).to.equal(expectedHeader)
            done()
        })

        it ('should call webSocketClient.subscribe twice with the right parameters', (done) => {
            subscribeStub.returns(new Subject())
            const expectedDestination = "A destination"
            client.subscribe(expectedDestination)
                  .subscribe(
                    (frame) => done(frame),
                    (err) => done("unexpected " + err),
                    () => done("unexpected")
                )
            client.subscribe(expectedDestination)
                  .subscribe(
                    (frame) => done(frame),
                    (err) => done("unexpected " + err),
                    () => done("unexpected")
                )
            Sinon.assert.calledTwice(subscribeStub)
            const actualParamsCall1 = subscribeStub.getCall(0).args
            expect(actualParamsCall1[0]).to.equal(expectedDestination)
            const actualParamsCall2 = subscribeStub.getCall(1).args
            expect(actualParamsCall2[0]).to.equal(expectedDestination)
            done()
        })

        it ('should give back the frame to the subscribers when messageReceivedSubject.next is called', (done) => {
            subscribeStub.returns(messageReceivedSubject)
            const expectedDestination = "A destination"
            const expectedFrame = {headers: {subscription: "sub-0"}}
            client.subscribe(expectedDestination)
                  .subscribe(
                    (frame) => {
                        expect(frame).to.equal(expectedFrame)
                        done()
                    },
                    (err) => done("unexpected " + err),
                    () => done("unexpected")
                )
            messageReceivedSubject.next(expectedFrame)
        })

    })

    describe ('subscribeBroadcast', () => {

        let subscribeSpy

        beforeEach ( () => {
            subscribeSpy = Sinon.spy(mockedConnection, 'subscribeTo')
        })

        afterEach ( () => {
            subscribeSpy.reset()
            subscribeSpy.restore()
        })

        it ('should call connectedClient.subscribe', () => {
            const expectedDestination = "A destination"
            client.subscribeBroadcast(expectedDestination)
            Sinon.assert.calledOnce(subscribeSpy)
            const actualParams = subscribeSpy.getCall(0).args
            expect(actualParams[0]).to.equal(expectedDestination)
        })

        it ('should call once connectedClient.subscribe', () => {
            const expectedDestination = "A destination"
            const subscribe1 = client.subscribeBroadcast(expectedDestination)
            const subscribe2 = client.subscribeBroadcast(expectedDestination)
            Sinon.assert.calledOnce(subscribeSpy)
            expect(subscribe1).to.equal(subscribe2)
        })

        it ('should call once connectedClient.subscribe per destination', () => {
            const expectedDestination1 = "A destination"
            const expectedDestination2 = "Another destination"
            const subscribe1 = client.subscribeBroadcast(expectedDestination1)
            const subscribe2 = client.subscribeBroadcast(expectedDestination2)
            Sinon.assert.calledTwice(subscribeSpy)
            expect(subscribe1).to.not.equal(subscribe2)
            const actualParams1 = subscribeSpy.getCall(0).args
            expect(actualParams1[0]).to.equal(expectedDestination1)
            const actualParams2 = subscribeSpy.getCall(1).args
            expect(actualParams2[0]).to.equal(expectedDestination2)
        })

    })

});

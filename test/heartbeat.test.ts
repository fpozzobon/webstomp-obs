import { expect } from 'chai'
import * as Sinon from 'sinon'
import Heartbeat, { HeartbeatOptions } from '../src/heartbeat'

describe ('Stompobservable heartbeat', () => {
    let tested: Heartbeat
    let sendStub
    let closeStub
    let callback

    beforeEach ( () => {
        sendStub = Sinon.stub()
        closeStub = Sinon.stub()
        callback = {sendPing: sendStub, close: closeStub}
        this.clock = Sinon.useFakeTimers();
    })

    afterEach ( () => {
        sendStub.resetHistory()
        closeStub.resetHistory()
    })

    describe ('with outgoing and incoming provided', () => {
        const heartbeatSettings: HeartbeatOptions = {outgoing: 100, incoming: 100}

        beforeEach ( () => {
            tested = new Heartbeat(heartbeatSettings)
        })

        it (`, serverIncoming > 0 and serverIncoming < outgoing should call send ping every serverIncoming` ,() => {
            tested.startHeartbeat(0, 10, callback)

            this.clock.tick(10)
            Sinon.assert.calledOnce(sendStub)
            Sinon.assert.notCalled(closeStub)
        })

        it (`, serverIncoming > 0 and serverIncoming > outgoing should call send ping every outgoing` ,() => {
            tested.startHeartbeat(0, 1000, callback)

            this.clock.tick(100)
            Sinon.assert.calledOnce(sendStub)
            Sinon.assert.notCalled(closeStub)
        })

        it (', serverIncoming === 0 should not send ping ' ,() => {
            tested.startHeartbeat(0, 0, callback)

            this.clock.tick(100)
            Sinon.assert.notCalled(sendStub)
            Sinon.assert.notCalled(closeStub)
        })

        it (`, serverOutgoing > 0 and serverOutgoing < incoming should call close after serverOutgoing * 2 inactivity` ,() => {
            tested.startHeartbeat(10, 0, callback)

            this.clock.tick(30)
            Sinon.assert.notCalled(sendStub)
            Sinon.assert.calledOnce(closeStub)
        })

        it (`, serverOutgoing > 0 and serverOutgoing > incoming should call close after serverOutgoing * 2 inactivity` ,() => {
            tested.startHeartbeat(1000, 0, callback)

            this.clock.tick(300)
            Sinon.assert.notCalled(sendStub)
            Sinon.assert.calledOnce(closeStub)
        })

        it (`, should not call close after timeout if there is a server activity` ,() => {
            tested.startHeartbeat(1000, 0, callback)
            this.clock.tick(100)
            tested.activityFromServer()
            this.clock.tick(200)

            Sinon.assert.notCalled(sendStub)
            Sinon.assert.notCalled(closeStub)
        })

        it (', serverOutgoing === 0 should not send close ' ,() => {
            tested.startHeartbeat(0, 0, callback)

            this.clock.tick(300)
            Sinon.assert.notCalled(sendStub)
            Sinon.assert.notCalled(closeStub)
        })

        it (`, should not call send and close after timeout if heartbeat has been stoped` ,() => {
            tested.startHeartbeat(1000, 100, callback)
            tested.stopHeartbeat()
            this.clock.tick(300)

            Sinon.assert.notCalled(sendStub)
            Sinon.assert.notCalled(closeStub)
        })

    })

});

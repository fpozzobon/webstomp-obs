import { expect } from 'chai'
import * as Sinon from 'sinon'
import { Subject } from 'rxjs/Subject';
import observableHeartbeat, { HeartbeatOptions } from '../src/observableHeartbeat'

describe ('Stompobservable heartbeat', () => {
    let tested: Heartbeat
    const sendStub = Sinon.stub()

    beforeEach ( () => {
        this.clock = Sinon.useFakeTimers();
    })

    afterEach ( () => {
        sendStub.resetHistory()
    })

    describe ('with outgoing and incoming provided', () => {
        const clientSettings: HeartbeatOptions = {outgoing: 100, incoming: 100}
        const serverSettings: HeartbeatOptions = {outgoing: 100, incoming: 100}
        let source: Subject

                beforeEach ( () => {
                    tested = observableHeartbeat(clientSettings, serverSettings, sendStub)
                    source = new Subject()
                })

        describe ('ping', () => {
            it (`should not be called if no subscribers` ,() => {
                this.clock.tick(100)
                Sinon.assert.notCalled(sendStub)
            })

            it (`should be called every 100ms`, () => {
                tested(source).subscribe()
                Sinon.assert.notCalled(sendStub)
                this.clock.tick(100)
                Sinon.assert.calledOnce(sendStub)
            })
        })

        describe ('activity from server', () => {

            const nextCallBack = Sinon.stub()
            const errorCallBack = Sinon.stub()
            beforeEach ( () => {
                tested(source).subscribe(
                    nextCallBack,
                    errorCallBack)
            })

            afterEach( () => {
                nextCallBack.resetHistory()
                errorCallBack.resetHistory()
            })

            it (`should unsubscribe after 100*2 ms if no response`, () => {
                this.clock.tick(200)
                Sinon.assert.notCalled(nextCallBack)
                Sinon.assert.calledOnce(errorCallBack)
            })

            it (`should not unsubscribe after 100*2 ms if response in between`, () => {
                this.clock.tick(100)
                source.next("an answer")
                this.clock.tick(100)
                Sinon.assert.notCalled(nextCallBack)
                Sinon.assert.notCalled(errorCallBack)
            })
        })

    })

});

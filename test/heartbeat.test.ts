import { expect } from 'chai'
import * as Sinon from 'sinon'
import Heartbeat, { HeartbeatOptions } from '../src/heartbeat'
import { VERSIONS, BYTES } from '../src/utils';

describe ('Stompobservable heartbeat', () => {
    let tested: Heartbeat
    let sendStub
    let closeStub
    let callback

    beforeEach ( () => {
        sendStub = Sinon.stub()
        closeStub = Sinon.stub()
        callback = {send: sendStub, close: closeStub}
        this.clock = Sinon.useFakeTimers();
    })

    afterEach ( () => {
        sendStub.reset()
        closeStub.reset()
    })

    describe ('with outgoing and incoming provided', () => {
        const heartbeatSettings: HeartbeatOptions = {outgoing: 100, incoming: 100}
        
        beforeEach ( () => {
            tested = new Heartbeat(heartbeatSettings)
        })

        const useCases = [{ version: VERSIONS.V1_0, sendCalled: false, closeCalled: false },
                          { version: VERSIONS.V1_1, sendCalled: true, closeCalled: true },
                          { version: VERSIONS.V1_2, sendCalled: true, closeCalled: true }]

        for (let i = 0; i < useCases.length; i++) {
            ( (testSpec) => {
                describe (`with version ${testSpec.version}`, () => {

                    const header = {version: testSpec.version}
                    const sendTxt = testSpec.sendCalled ? 'call send' : 'not call send'
                    const closeTxt = testSpec.closeCalled ? 'call close' : 'not call close'

                    const testSend = () => {
                        if(testSpec.sendCalled) {
                            Sinon.assert.calledOnce(sendStub)
                            Sinon.assert.calledWith(sendStub, BYTES.LF)
                        } else {
                            Sinon.assert.notCalled(sendStub)
                        }
                    }
                    const testClose = () => testSpec.closeCalled ? Sinon.assert.calledOnce(closeStub) : Sinon.assert.notCalled(closeStub)

                    it (`, serverIncoming > 0 and serverIncoming < outgoing should ${sendTxt} ping every serverIncoming` ,() => {
                        tested.startHeartbeat({...header, 'heart-beat':'0,10'}, callback)

                        this.clock.tick(10)
                        testSend()
                        Sinon.assert.notCalled(closeStub)
                    })

                    it (`, serverIncoming > 0 and serverIncoming > outgoing should ${sendTxt} ping every outgoing` ,() => {
                        tested.startHeartbeat({...header, 'heart-beat':'0,1000'}, callback)

                        this.clock.tick(100)
                        testSend()
                        Sinon.assert.notCalled(closeStub)
                    })

                    it (', serverIncoming === 0 should not send ping ' ,() => {
                        tested.startHeartbeat({...header, 'heart-beat':'0,0'}, callback)

                        this.clock.tick(100)
                        Sinon.assert.notCalled(sendStub)
                        Sinon.assert.notCalled(closeStub)
                    })
                    
                    it (`, serverOutgoing > 0 and serverOutgoing < incoming should ${closeTxt} after serverOutgoing * 2 inactivity` ,() => {
                        tested.startHeartbeat({...header, 'heart-beat':'10,0'}, callback)

                        this.clock.tick(30)
                        Sinon.assert.notCalled(sendStub)
                        testClose()
                    })

                    it (`, serverOutgoing > 0 and serverOutgoing > incoming should ${closeTxt} after serverOutgoing * 2 inactivity` ,() => {
                        tested.startHeartbeat({...header, 'heart-beat':'1000,0'}, callback)

                        this.clock.tick(300)
                        Sinon.assert.notCalled(sendStub)
                        testClose()
                    })

                    it (`, should not call close after timeout if there is a server activity` ,() => {
                        tested.startHeartbeat({...header, 'heart-beat':'1000,0'}, callback)
                        this.clock.tick(100)
                        tested.activityFromServer()
                        this.clock.tick(200)

                        Sinon.assert.notCalled(sendStub)
                        Sinon.assert.notCalled(closeStub)
                    })

                    it (', serverOutgoing === 0 should not send close ' ,() => {
                        tested.startHeartbeat({...header, 'heart-beat':'0,0'}, callback)

                        this.clock.tick(300)
                        Sinon.assert.notCalled(sendStub)
                        Sinon.assert.notCalled(closeStub)
                    })
                    
                    it (`, should not call send and close after timeout if heartbeat has been stoped` ,() => {
                        tested.startHeartbeat({...header, 'heart-beat':'1000,100'}, callback)
                        tested.stopHeartbeat()
                        this.clock.tick(300)

                        Sinon.assert.notCalled(sendStub)
                        Sinon.assert.notCalled(closeStub)
                    })
                    
                })
            })(useCases[i]);
        }

    })

});

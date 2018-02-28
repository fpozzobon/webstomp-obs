
import { logger } from './utils';

export interface HeartbeatOptions {
    outgoing: number,
    incoming: number
}

class Heartbeat {

    public heartbeatSettings: HeartbeatOptions;

    private pinger: any;
    private ponger: any;
    private lastServerActivity: number;

    constructor(heartbeatOption: HeartbeatOptions | boolean = {outgoing: 10000, incoming: 10000}) {
        this.heartbeatSettings = (heartbeatOption as HeartbeatOptions) || {outgoing: 0, incoming: 0};
    }

    // Heart-beat negotiation
    public startHeartbeat = ( serverOutgoing: number,
                              serverIncoming: number,
                              callback: { sendPing: () => void,
                                          close: Function}) => {
        this.stopHeartbeat();

        // heart-beat header received from the server looks like:
        //
        //     heart-beat: sx, sy

        if (!(this.heartbeatSettings.outgoing === 0 || serverIncoming === 0)) {
            const ttl = Math.min(this.heartbeatSettings.outgoing, serverIncoming);
            this._startPinger(ttl, callback.sendPing);
        }

        if (!(this.heartbeatSettings.incoming === 0 || serverOutgoing === 0)) {
            const ttl = Math.min(this.heartbeatSettings.incoming, serverOutgoing);
            this._startPonger(ttl, callback.close);
        }
    }

    public stopHeartbeat = () => {
        clearInterval(this.pinger);
        clearInterval(this.ponger);
    }

    public activityFromServer = () => {
        this.lastServerActivity = Date.now();
    }

    private _startPinger = (ttl: number, sendPing: () => void) => {
        logger.debug(`send PING every ${ttl}ms`);
        this.pinger = setInterval(() => {
            sendPing();
            logger.debug('>>> PING');
        }, ttl);
    }

    private _startPonger = (ttl: number, close: Function) => {
        logger.debug(`check PONG every ${ttl}ms`);
        this.lastServerActivity = Date.now();
        this.ponger = setInterval(() => {
            const delta = Date.now() - this.lastServerActivity;
            // We wait twice the TTL to be flexible on window's setInterval calls
            if (delta > ttl * 2) {
                logger.debug(`did not receive server activity for the last ${delta}ms`);
                close();
            }
        }, ttl);
    }

}

export default Heartbeat;

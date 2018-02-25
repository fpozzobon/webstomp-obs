import { IWebSocket } from './client';
import { ConnectedHeaders } from './headers';
import { VERSIONS, BYTES, logger } from './utils';

export interface HeartbeatOptions {
    outgoing: number,
    incoming: number
}

class Heartbeat {

    private heartbeatSettings: HeartbeatOptions;

    private pinger: any;
    private ponger: any;
    private lastServerActivity: number;

    constructor(heartbeatSettings: HeartbeatOptions) {
        this.heartbeatSettings = heartbeatSettings;
    }

    // Heart-beat negotiation
    public startHeartbeat = ( headers: ConnectedHeaders,
                              callback: { send: (data: any) => any,
                                          close: Function}) => {
        this.stopHeartbeat();
        if (headers.version !== VERSIONS.V1_1 && headers.version !== VERSIONS.V1_2) return;

        // heart-beat header received from the server looks like:
        //
        //     heart-beat: sx, sy
        const [serverOutgoing, serverIncoming] = (headers['heart-beat'] || '0,0').split(',').map((v: string) => parseInt(v, 10));

        if (!(this.heartbeatSettings.outgoing === 0 || serverIncoming === 0)) {
            const ttl = Math.min(this.heartbeatSettings.outgoing, serverIncoming);
            this._startPinger(ttl, callback.send);
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

    private _startPinger = (ttl: number, send: (data: any) => any) => {
        logger.debug(`send PING every ${ttl}ms`);
        this.pinger = setInterval(() => {
            send(BYTES.LF);
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

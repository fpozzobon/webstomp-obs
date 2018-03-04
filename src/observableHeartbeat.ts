import { Observable } from 'rxjs/Observable';
import 'rxjs/add/operator/timeout';
import 'rxjs/add/observable/interval';
import 'rxjs/add/observable/merge';
import 'rxjs/add/observable/empty';

import { logger } from './utils';

export interface HeartbeatOptions {
    outgoing: number,
    incoming: number
}

const observableHeartbeat = (clientSettings: HeartbeatOptions,
                             serverSettings: HeartbeatOptions,
                             sendPing: () => void) => {

    // the heartbeat should happen min of the client incoming expected or service outgoing expected
    const activityTTL = Math.min(clientSettings.incoming, clientSettings.outgoing)
    // the client should ping min of the client outgoing expected or service incoming expected
    const pingTTL = Math.min(serverSettings.outgoing, serverSettings.incoming)

    // the heartbeat should happen min of the client incoming expected or service outgoing expected
    const activityfromServer = (source : Observable<any>) : Observable<any> =>
        (!(activityTTL === 0)) ? source.timeout(activityTTL) : source

    const pingToServer = () : Observable<any> =>
        (!(pingTTL === 0)) ? Observable.interval(pingTTL).do(sendPing) : Observable.empty()

    return (source : Observable<any>) =>
        source.pipe(activityfromServer, pingToServer)

}

export default observableHeartbeat

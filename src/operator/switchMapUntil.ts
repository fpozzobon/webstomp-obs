import { Observable, ObservableInput } from 'rxjs/Observable'
import { Subject } from 'rxjs/Subject'
import { doFinally } from './doFinally'

import 'rxjs/add/operator/switchMap'

export const switchMapUntil = <T, R, S>(project: (value: T, index: number) => ObservableInput<R>,
                                            f: (value: R) => Observable<S>) => {
    const notifier = new Subject()
    return (source: Observable<T>): Observable<R> =>
        source.switchMap((value, index) => project(value, index))
            .pipe(doFinally((value: R, error) => {
                if (value && !error) {
                    const notifier = new Subject()
                    f(value).subscribe(() => {
                        notifier.complete()
                    })
                    return notifier
                } else {
                    return Observable.empty()
                }
            }))
}

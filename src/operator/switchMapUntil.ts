import { Observable, ObservableInput } from 'rxjs/Observable'
import { Subject } from 'rxjs/Subject'
import { doFinally } from './doFinally'

import 'rxjs/add/operator/switchMap'

export const switchMapUntil = <T, R, S>(project: (value: T, index: number) => ObservableInput<R>, f: (value: R, notifier: Subject<any>) => Observable<S>) => {
    const notifier = new Subject()
    return (source: Observable<T>): Observable<R> =>
        source.switchMap((value, index) => project(value, index))
            .pipe(doFinally((value) => {
                const notifier = new Subject()
                f(value, notifier).subscribe(() => {
                    notifier.complete()
                })
                return notifier
            }))
}

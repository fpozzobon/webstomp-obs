import { Observable, ObservableInput } from 'rxjs/Observable'
import { Observer } from 'rxjs/Observer'
import { Subject } from 'rxjs/Subject'

import 'rxjs/add/operator/switchMap'
import 'rxjs/add/operator/takeUntil'

export const switchMapUntil = <T, R>(project: (value: T, index: number, notifier: Subject<any>) => ObservableInput<R>) => {
    const notifier = new Subject()
    return (source: Observable<T>): Observable<R> =>
        Observable.create((observer: Observer<T>) => {
            const internalSub = source.subscribe(
                (val) => observer.next(val),
                (err) => observer.error(err))
            return () => {
                notifier.subscribe(() => internalSub.unsubscribe(),
                                () => internalSub.unsubscribe(),
                                () => internalSub.unsubscribe())
                observer.complete()
            }
        }).switchMap((value, index) => project(value, index, notifier))
}

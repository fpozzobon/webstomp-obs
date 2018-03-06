import { Observable, ObservableInput } from 'rxjs/Observable'
import { Subject } from 'rxjs/Subject'

import 'rxjs/add/operator/switchMap'
import 'rxjs/add/operator/takeUntil'

export const switchMapUntil = <T, R>(project: (value: T, index: number) => ObservableInput<R>) => {
    const keepAlive: Subject<T> = new Subject()
    return (source: Observable<T>): Observable<R> =>
        source.takeUntil(keepAlive).switchMap(project).finally(() => keepAlive.complete())
}

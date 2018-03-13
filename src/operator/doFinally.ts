import { Observable } from 'rxjs/Observable'
import { Observer } from 'rxjs/Observer'
import { Subject } from 'rxjs/Subject'

export const doFinally = <T, R, S>(f: (value: T, error: R) => Observable<S>) => {
    let lastValue: T = null
    let lastError: R = null

    return (source: Observable<T>): Observable<T> =>
        Observable.create((observer: Observer<T>) => {

            const onNextValue = (val: T) => {
                    lastValue = val
                    observer.next(val)
                }

            const onError = (err: R) => {
                    lastError = err
                    observer.error(err)
                }

            const internalSub = source.subscribe(onNextValue, onError)
            const terminate = () => {
                internalSub.unsubscribe()
                observer.complete()
            }

            return () => {
                f(lastValue, lastError).subscribe(terminate, terminate, terminate)
            }
        })
}

export const doUnsubscribe = <T, R>(f: (value: T, error: R) => void) => {
    const notifier = new Subject()
    return (source: Observable<T>): Observable<T> =>
        source.pipe(doFinally((value: T, error: R) => {
                f(value, error)
                return Observable.empty()
            }))
}

import { Observable } from 'rxjs/Observable'
import { Observer } from 'rxjs/Observer'

export const doFinally = <T, R>(f: (value: T) => Observable<R>) => {
    let lastValue: T = null

    const onNextValue = (observer: Observer<T>) =>
        (val) => {
            lastValue = val
            observer.next(val)
        }

    const onError = (observer: Observer<T>) =>
        (err) => {
            lastValue = null
            observer.error(err)
        }

    return (source: Observable<T>): Observable<T> =>
        Observable.create((observer: Observer<T>) => {
            const internalSub = source.subscribe(onNextValue(observer), onError(observer))
            const terminate = () => internalSub.unsubscribe()

            return () => {
                if (lastValue) {
                    f(lastValue).subscribe(terminate, terminate, terminate)
                } else {
                    terminate()
                }
                observer.complete()
            }
        })
}

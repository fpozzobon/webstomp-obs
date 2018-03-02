import { Observable } from 'rxjs/Observable'
import { stompobservable } from 'webstomp-obs'
import Client from 'webstomp-obs/types/client'
import { ConnectedClient } from 'webstomp-obs/types/connectedClient'
import 'rxjs/add/operator/first'
import 'rxjs/add/observable/from'

export class Chat {

  private wsClient: Client
  private sourceConnection: Observable<ConnectedClient>
  private topic: string

  constructor (url: string, login: string, password: string, topic: string) {
    this.topic = topic
    this.connect(url, login, password)
  }

  private connect = (url: string, login: string, password: string) : void => {
    this.wsClient = stompobservable.client(url, {debug: true} as any)
    this.sourceConnection = this.wsClient.connect({login: login, passcode: password})
  }

  public onConnect = (onConnect: Function, onError?: Function): void => {
    this.sourceConnection.subscribe(
      function (connectedClient: ConnectedClient) {
          onConnect(connectedClient)
      },
      function (err: string) {
          onError && onError(err);
      }
    )
  }

  public onMessage = (onMessageFn: Function, onError?: Function): void => {
    this.onConnect(
      (connectedClient: ConnectedClient) => {
        connectedClient
          .subscribeBroadcast(this.topic, {ack: 'client'})
          .subscribe(
              function (message) {
                  onMessageFn(message)
                  message.ack()
              },
              function (err) {
                  onError && onError(err)
              }
          )
      },
      (err: string) => {
        onError && onError(err)
      }
    )
  }

  public onError = (onErrorMsgFn: Function): void => {
    this.onConnect(
      (connectedClient: ConnectedClient) => {
        connectedClient.error()
          .subscribe(
              function (message) {
                  onErrorMsgFn(message)
              }
          )
      }
    )
  }

  public onConnectionError = (onConnectionErrorMsgFn: Function): void => {
    this.onConnect(
      (connectedClient: ConnectedClient) => {
        connectedClient.connectionError()
          .subscribe(
              function (message) {
                  onConnectionErrorMsgFn(message)
              }
          )
      }
    )
  }

  public sendBroadcast = (message: string) : void => {
    Observable.from(this.sourceConnection).first().subscribe(
      (connectedClient: ConnectedClient) => {
        connectedClient.send(this.topic, message)
      },
      (error: string) => {
      }
    )
  }

}

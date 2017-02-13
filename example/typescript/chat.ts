import stompobservable from 'webstomp-obs'
import Client from 'webstomp-obs/types/client'
import { ConnectedClient } from 'webstomp-obs/types/connectedClient'
import { Observable } from 'rxjs/Observable'

export class Chat {

  private wsClient: Client
  private sourceConnection: Observable<ConnectedClient>
  private topic: string

  constructor (url: string, login: string, password: string, topic: string) {
    this.topic = topic
    this.connect(url, login, password)
  }

  private connect = (url: string, login: string, password: string) : void => {
    this.wsClient = stompobservable.client(url)
    this.sourceConnection = this.wsClient.connect({login: login, passcode: password})
  }

  public onConnect = (onConnect: Function, onError: Function): void => {
    this.sourceConnection.subscribe(
      function (connectedClient: ConnectedClient) {
          onConnect(connectedClient)
      },
      function (err: string) {
          onError(err);
      }
    )
  }

  public onMessage = (onMessageFn: Function, onError: Function): void => {
    this.onConnect(
      (connectedClient: ConnectedClient) => {
        connectedClient
          .subscribeBroadcast(this.topic)
          .subscribe(
              function (message) {
                  onMessageFn(message)
              },
              function (err) {
                  onError(err)
              }
          )
      },
      (err: string) => {
        onError(err)
      }
    )
  }

  public sendBroadcast = (message: string) : void => {
    this.onConnect(
      (connectedClient: ConnectedClient) => {
        connectedClient.send(this.topic, message)
      },
      (error: string) => {

      }
    )
  }

}

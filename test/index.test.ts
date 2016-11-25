import { expect } from 'chai'
import stompObservable from '../src/index'
import * as Sinon from 'sinon'

let Client = require ('../src/client')

describe ('Stompobservable index', () => {
   describe ('VERSIONS', () => {

       const versions = stompObservable.VERSIONS;

      it ('supportedVersions() should give back the supported versions "1.2,1.1,1.0"', () => {
          expect(versions.supportedVersions()).equals('1.2,1.1,1.0');
      })

       it ('supportedProtocols() should give back the supported versions [v10.stomp, v11.stomp, v12.stomp]', () => {
           const supportedProtocols: string[] = versions.supportedProtocols();

           expect(supportedProtocols).to.include.members(['v10.stomp', 'v11.stomp', 'v12.stomp']);
       })

   });

    describe ('client function', () => {


        beforeEach( () => {
            Client.default = Sinon.stub()
        })

        afterEach( () => {
            Client.default.reset()
        })

        it ('should create a new Client with a function creating a Websocket', () => {
            stompObservable.client('fakeUrl');
            expect(Client.default.calledWithNew()).to.be.true;
            expect(Client.default.getCall(0).args[0]).to.be.a('function');
        })

        it ('should return the client instance', () => {
            let actualReturn = stompObservable.client('fakeUrl');
            expect(actualReturn).to.be.equal(Client.default.returnValues[0]);
        })

    })

    describe ('over function', () => {

        let createWsConnectionSpy

        beforeEach( () => {
            Client.default = Sinon.spy()
            createWsConnectionSpy = Sinon.spy()
        })

        afterEach( () => {
            Client.default.reset()
        })

        it ('should create a new Client using createWsConnection function in parameter', () => {
            stompObservable.over(createWsConnectionSpy);
            expect(Client.default.calledWithNew()).to.be.true;
            expect(createWsConnectionSpy).to.be.equal(Client.default.getCall(0).args[0]);
            expect({}).to.be.eql(Client.default.getCall(0).args[1]);
        })

        it ('should create a new Client using createWsConnection function and options in parameter', () => {
            let fakeOptions = Sinon.spy()
            stompObservable.over(createWsConnectionSpy, fakeOptions as any);
            expect(Client.default.calledWithNew()).to.be.true;
            expect(createWsConnectionSpy).to.be.equal(Client.default.getCall(0).args[0]);
            expect(fakeOptions).to.be.eql(Client.default.getCall(0).args[1]);
        })

        it ('should return the client instance', () => {
            let actualReturn = stompObservable.over(createWsConnectionSpy);
            expect(actualReturn).to.be.equal(Client.default.returnValues[0]);
        })

    })
});
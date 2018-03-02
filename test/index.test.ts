import { expect } from 'chai'
import { stompobservable } from '../src/index'
import * as Sinon from 'sinon'
import * as client from '../src/client'

describe ('stompobservable index', () => {

    const clientSpy = Sinon.spy(client, 'default')

    afterEach( () => {
        clientSpy.resetHistory()
    })

    describe ('VERSIONS', () => {

        const versions = stompobservable.VERSIONS;

        it ('supportedVersions() should give back the supported versions "1.2,1.1,1.0"', () => {
            expect(versions.supportedVersions()).equals('1.2,1.1,1.0');
        })

        it ('supportedProtocols() should give back the supported versions [v10.stomp, v11.stomp, v12.stomp]', () => {
            const supportedProtocols: string[] = versions.supportedProtocols();

            expect(supportedProtocols).to.include.members(['v10.stomp', 'v11.stomp', 'v12.stomp']);
        })

    });

    describe ('client function', () => {

        it ('should create a new Client with a function creating a Websocket', () => {
            stompobservable.client('fakeUrl');
            expect(clientSpy.calledWithNew()).to.be.true;
            expect(clientSpy.getCall(0).args[0]).to.be.a('function');
        })

        it ('should return the client instance', () => {
            let actualReturn = stompobservable.client('fakeUrl');
            expect(actualReturn).to.be.equal(clientSpy.returnValues[0]);
        })

    })

    describe ('over function', () => {

        let createWsConnectionSpy

        beforeEach( () => {
            createWsConnectionSpy = Sinon.spy()
        })

        afterEach( () => {
            createWsConnectionSpy.resetHistory()
        })

        it ('should create a new Client using createWsConnection function in parameter', () => {
            stompobservable.over(createWsConnectionSpy);
            expect(clientSpy.calledWithNew()).to.be.true;
            expect(createWsConnectionSpy).to.be.equal(clientSpy.getCall(0).args[0]);
            expect({}).to.be.eql(clientSpy.getCall(0).args[1]);
        })

        it ('should create a new Client using createWsConnection function and options in parameter', () => {
            let fakeOptions = Sinon.spy()
            stompobservable.over(createWsConnectionSpy, fakeOptions as any);
            expect(clientSpy.calledWithNew()).to.be.true;
            expect(createWsConnectionSpy).to.be.equal(clientSpy.getCall(0).args[0]);
            expect(fakeOptions).to.be.eql(clientSpy.getCall(0).args[1]);
        })

        it ('should return the client instance', () => {
            let actualReturn = stompobservable.over(createWsConnectionSpy);
            expect(actualReturn).to.be.equal(clientSpy.returnValues[0]);
        })

    })
});

export type StandardHeaders = {
    'content-length'?: string,
    'content-type'?: string
}

export interface ExtendedHeaders extends StandardHeaders {
    'amqp-message-id'?: string,
    'app-id'?: string,
    'content-encoding'?: string,
    'correlation-id'?: string,
    custom?: string,
    persistent?: string,
    redelivered?: string,
    'reply-to'?: string,
    'message-id'?: string,
    subscription?: string,
    timestamp?: string,
    type?: string,
}

export type ConnectionHeaders = {
    host: string,
    'accept-version': string,
    login?: string,
    passcode?: string,
    'heart-beat'?: string
}

export type ConnectedHeaders = {
    version: string,
    session?: string,
    server?: string,
    'heart-beat'?: string
}

export interface SendHeaders extends ExtendedHeaders {
    destination: string,
    transaction?: string
}

export interface SubscribeHeaders extends UnsubscribeHeaders {
    destination: string,
    ack?: ACK
}

export interface UnsubscribeHeaders extends StandardHeaders {
    id: string
}

export type AckHeaders = AckHeaders_V1 | AckHeaders_V1_2;
export type NackHeaders = AckHeaders;

export type AckHeaders_V1 = {
    'message-id': string,
    subscription: string,
    transaction?: string
}

export type AckHeaders_V1_2 = {
    id: string,
    transaction?: string
}

export type BeginHeaders = {
    transaction: string
}

export type CommitHeaders = BeginHeaders

export type AbortHeaders = BeginHeaders

export type DisconnectHeaders = {
    receipt?: string
}

export type ACK = 'auto' | 'client' | 'client-individual';

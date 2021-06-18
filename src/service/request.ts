import IsomorphicWebSocket from './websocket';

export interface Service {
    name: string
    endpoints: Endpoint[]
}

export interface EndpointArgument {
    unit: string
    streamed?: boolean
}

export interface Endpoint {
    path: string
    in?: EndpointArgument
    out?: EndpointArgument
}

export interface ServerConfig {
    hostname: string
    port: number
    secure: boolean
}

export class GlobalConfig {
    static config: ServerConfig
    static set(newConfig: ServerConfig) {
        this.config = newConfig
    }
}

export function openRequest(config: ServerConfig, path: string): IsomorphicWebSocket {
    const finalUrl = `${config.secure ? 'ws' : 'wss'}://${config.hostname}:${config.port}${path}`
    return new IsomorphicWebSocket(finalUrl)
}

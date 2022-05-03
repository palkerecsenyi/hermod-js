import { WebSocketRouter } from './router'

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
    id: number
    in?: EndpointArgument
    out?: EndpointArgument
}

export interface ServerConfig {
    hostname: string
    port: number

    /**
     * Use wss instead of ws. Requires server configuration.
     */
    secure: boolean

    /**
     * Including the first /
     * @example /routers/hermod
     */
    path: string

    /**
     * How long to wait to establish a session within an existing WS connection (millis)
     * 0 will disable the timeout
     */
    timeout: number
}

export class GlobalServer {
    static config: ServerConfig
    static connection: WebSocketRouter
    static set(newConfig: ServerConfig) {
        this.config = newConfig
    }

    static async open() {
        if (!this.config) {
            throw new Error("GlobalServer not configured. Use GlobalConfig.set() to configure.")
        }

        const finalUrl = `${this.config.secure ? 'wss' : 'ws'}://${this.config.hostname}:${this.config.port}${this.config.path}`
        this.connection = new WebSocketRouter(finalUrl, this.config.timeout)
        await this.connection.waitForConnection()
    }

    static close() {
        if (!this.connection || !this.connection.webSocket.isReady) {
            throw new Error("WebSocket connection not open")
        }

        this.connection.webSocket.close()
    }
}

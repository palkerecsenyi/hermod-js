import { AuthenticationEndpointId } from './route'
import WebSocketRouter from './router'

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

    static async open(token?: string) {
        if (!this.config) {
            throw new Error("GlobalServer not configured. Use GlobalConfig.set() to configure.")
        }

        let finalUrl = `${this.config.secure ? 'wss' : 'ws'}://${this.config.hostname}:${this.config.port}${this.config.path}/`
        if (token !== undefined) {
            finalUrl += `?token=${token}`
        }

        this.connection = new WebSocketRouter(finalUrl, this.config.timeout)
        await this.connection.waitForConnection()
    }

    private static ensureOpen() {
        if (!this.connection || !this.connection.webSocket.isReady) {
            throw new Error("WebSocket connection not open")
        }
    }

    static close() {
        this.ensureOpen()
        this.connection.webSocket.close()
    }

    static async setAuth(token: string, timeout = 5000) {
        this.ensureOpen()
        const route = this.connection.getRoute(AuthenticationEndpointId)
        await route.authenticate(token, timeout)
    }
}

import IsomorphicWebSocket from './websocket.js';
import WebSocketRoute, { AuthenticationEndpointId } from './route.js';

type CancelHandler = () => void

export interface ServerConfig {
    hostname: string
    /**
     * @default 443 if secure = true, 80 if secure = false
     */
    port?: number

    /**
     * Use wss instead of ws. Requires server configuration.
     * @default false
     */
    secure?: boolean

    /**
     * Including the first /, excluding the last /
     * @example /routers/hermod
     * @default /hermod
     */
    path?: string

    /**
     * How long to wait to establish a session within an existing WS connection (milliseconds)
     * 0 will disable the timeout
     * @default 5000
     */
    timeout: number
}

/**
 * WebSocketRouter uses a single WebSocket channel to transmit requests and responses
 * to/from multiple different endpoints, helping to reduce overhead.
 *
 * This is the class that maintains the actual IsomorphicWebSocket connection. Never instantiate IsomorphicWebSocket
 * directly.
 */
export default class WebSocketRouter {
    readonly webSocket: IsomorphicWebSocket
    /**
     * Timeout for individual WebSocketRoute connection session establishments
     */
    readonly connectionTimeout: number
    constructor(config: ServerConfig, token?: string) {
        config.secure ??= false
        const scheme = config.secure ? 'wss' : 'ws'

        config.port ??= config.secure ? 443 : 80
        config.path ??= '/hermod'

        let finalUrl = `${scheme}://${config.hostname}:${config.port}${config.path}/`
        if (token !== undefined) {
            finalUrl += `?token=${token}`
        }

        this.webSocket = new IsomorphicWebSocket(finalUrl)
        this.connectionTimeout = config.timeout ?? 5000
    }

    /**
     * Waits for the connection to become open if it's currently in WebSocketState.Connecting. If it's already open,
     * the Promise will resolve instantaneously. If it's closed, the Promise will reject with an error.
     */
    async waitForConnection() {
        await this.webSocket.waitForConnection()
    }

    private checkOpen() {
        if (!this.webSocket.isReady) {
            throw new Error("WebSocket connection not ready")
        }
    }

    /**
     * Gets an instance of WebSocketRoute corresponding to the specified endpoint ID. This will automatically start
     * listening for messages and add them to a queue, which will start being dequeued from once the route has at least
     * one listener.
     * @param id
     * @param token A token to use specifically for this single instance of this route. Overrides any existing tokens
     * higher-up (connection-wide tokens)
     */
    getRoute(id: number, token?: string) {
        this.checkOpen()
        return new WebSocketRoute(this, id, token)
    }

    /**
     * Sends an authentication request to the server. An alternative to passing the token as a parameter to the constructor.
     * Calling when the WebSocket connection is not open (IsomorphicWebSocket.isReady) will throw an error.
     * @param token
     * @param timeout - Can optionally be specified to override connectionTimeout
     */
    async setAuth(token: string, timeout?: number) {
        this.checkOpen()
        const route = this.getRoute(AuthenticationEndpointId)
        await route.authenticate(token, timeout ?? this.connectionTimeout)
    }

    /**
     * onClose takes a listener that is called exactly once, when the underlying WebSocket connection is closed. Calling
     * this function before the connection is open (IsomorphicWebSocket.isReady) will throw an error.
     * @param listener
     * @returns {CancelHandler} - Call this to cancel the listener
     */
    onClose(listener: () => void): CancelHandler {
        const cancel = this.webSocket.listen((open) => {
            if (!open) {
                cancel()
                listener()
            }
        })

        return cancel
    }

    /**
     * onError initiates a listener for global error events; that is, errors not related to a specific endpoint. These
     * include server configuration events or failed authentication. They don't include errors thrown by the user's
     * endpoint handler functions.
     *
     * Global error events imply that the WebSocket connection is inherently faulty in some way, and they therefore also
     * automatically close the connection. An onError event will be either pro- or preceded by an onClose event, depending
     * on how long the WebSocket takes to close. Make sure not to depend on the order of these events.
     * @param listener
     * @returns {CancelHandler} - Call this to cancel the listener
     */
    onError(listener: (error: Error) => void): CancelHandler {
        const cancel = this.webSocket.listen((open, data, error) => {
            if (error) {
                cancel()
                listener(new Error(error))
            }
        })

        return cancel
    }
}

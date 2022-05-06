import IsomorphicWebSocket from './websocket'
import WebSocketRoute from './route'

/**
 * WebSocketRouter uses a single WebSocket channel to transmit requests and responses
 * to/from multiple different endpoints, helping to reduce overhead
 */
export default class WebSocketRouter {
    readonly webSocket: IsomorphicWebSocket
    /**
     * Timeout for individual WebSocketRoute connection session establishments
     */
    readonly connectionTimeout: number
    constructor(baseUrl: string, connectionTimeout = 5000) {
        this.webSocket = new IsomorphicWebSocket(baseUrl)
        this.connectionTimeout = connectionTimeout
    }

    async waitForConnection() {
        await this.webSocket.waitForConnection()
    }

    getRoute(id: number) {
        if (!this.webSocket.isReady) {
            throw new Error("tried opening a session without an initialised WebSocket connection")
        }
        return new WebSocketRoute(this, id)
    }
}

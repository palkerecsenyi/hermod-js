import IsomorphicWebSocket from './websocket'
import Uint8List from '../encoder/uint8list'

/**
 * WebSocketRouter uses a single WebSocket channel to transmit requests and responses
 * to/from multiple different endpoints, helping to reduce overhead
 */
export class WebSocketRouter {
    readonly webSocket: IsomorphicWebSocket

    /**
     * Timeout for individual WebSocketRoute connection session establishments
     */
    readonly connectionTimeout: number
    constructor(baseUrl: string, connectionTimeout = 5000) {
        this.webSocket = new IsomorphicWebSocket(baseUrl)
        this.connectionTimeout = connectionTimeout
    }

    waitForConnection() {
        return this.webSocket.waitForConnection()
    }

    getRoute(id: number) {
        return new WebSocketRoute(this, id)
    }
}

enum MessageFlags {
    Data = 0b10101010,
    ClientSessionRequest = 0b00001111,
    ServerSessionAck = 0b11110000,
    Close = 0b11111111,
    CloseAck = 0b11111110
}

export class WebSocketRoute {
    private readonly router: WebSocketRouter
    private readonly endpointId: number
    private sessionId: number | undefined
    private readonly clientId: number
    private static nextClientId = 0x00000000
    constructor(router: WebSocketRouter, id: number) {
        this.router = router

        // id must be an unsigned 16-bit number
        if (id > 65535 || id < 0) {
            throw new Error("id must be an unsigned 16-bit number")
        }
        this.endpointId = id

        this.clientId = WebSocketRoute.nextClientId
        if (WebSocketRoute.nextClientId + 1 >= 0xffffffff) {
            WebSocketRoute.nextClientId = 0x00000000
        } else {
            WebSocketRoute.nextClientId++
        }
    }

    get isOpen() {
        return this.sessionId !== undefined
    }

    /**
     * Session establishment messages have a slightly different format:
     *
     * | Endpoint ID (16 bits) | Request flag (8 bits) = 00001111 | Client ID (32 bits) |
     *
     * The server will send the client ID back as-is so the client can identify which session establishment request
     * it's responding too. However, this won't be the session ID — the server will generate that and include it
     * in the response as follows:
     *
     * | Endpoint ID (16 bits) | Request flag (8 bits) = 11110000 | Client ID (32 bits) | Session ID (32 bits) |
     */
    async open() {
        const openMessageList = new Uint8List()
        openMessageList.push16(this.endpointId)
        openMessageList.push8(MessageFlags.ClientSessionRequest)
        openMessageList.push32(this.clientId)
        this.router.webSocket.send(openMessageList)

        const response = await Promise.race([
            this.receiveSessionAcknowledgement(),
            new Promise<number>(resolve => {
                setTimeout(() => {
                    resolve(-1)
                }, this.router.connectionTimeout)
            }),
        ])

        if (response === -1) {
            throw new Error("Session establishment timed out")
        }

        this.sessionId = response
    }

    /**
     * Format for messages:
     * | Endpoint ID (16 bits) | Request flag (8 bits) | Session ID (32 bits) | Encoded Unit |
     *
     * Request flag is 11111111 to indicate the end of the transmission, 00001111 to request to open a new session,
     * 11110000 for the server to acknowledge a new session, and 00000000 for all normal transmissions
     * @param data Uint8List-format data to send, excluding endpoint ID/end flag
     */
    send(data: Uint8List) {
        if (this.sessionId === undefined) {
            throw new Error("Session not open, cannot send messages!")
        }

        const messageFrameList = new Uint8List()
        // Endpoint ID
        messageFrameList.push16(this.endpointId)
        // Request flag
        messageFrameList.push8(MessageFlags.Data)
        // Session ID
        messageFrameList.push32(this.sessionId)

        data.mergeStart(messageFrameList)
        this.router.webSocket.send(data)
    }

    private async receiveSessionAcknowledgement(): Promise<number> {
        for await (const message of this.receive(true)) {
            const clientId = message.read32()
            if (clientId !== this.clientId) {
                continue
            }

            return message.read32()
        }

        throw new Error("WebSocket closed without session acknowledgement")
    }

    async* receive(sessionAcknowledgements = false) {
        if (!sessionAcknowledgements && this.sessionId === undefined) {
            throw new Error("Session not open, cannot receive messages (other than session acknowledgements)!")
        }

        for await (const message of this.router.webSocket.message()) {
            const endpointId = message.read16()
            if (endpointId !== this.endpointId) {
                message.seek(-2)
                continue
            }

            const requestFlag = message.read8()
            if (requestFlag === MessageFlags.ServerSessionAck) {
                if (sessionAcknowledgements) {
                    yield message
                } else {
                    continue
                }
            }

            const sessionId = message.read32()
            if (sessionId !== this.sessionId) {
                continue
            }

            if (requestFlag === MessageFlags.Close) {
                const acknowledgementMessage = new Uint8List()
                acknowledgementMessage.push16(this.endpointId)
                acknowledgementMessage.push8(MessageFlags.CloseAck)
                acknowledgementMessage.push32(this.sessionId)
                this.router.webSocket.send(acknowledgementMessage)
                break
            }

            if (requestFlag === MessageFlags.CloseAck) {
                break
            }

            if (requestFlag === MessageFlags.Data) {
                yield message
            } else {
                console.warn(`Unrecognised flag from server ${requestFlag.toString(2)}`)
            }
        }
    }

    close() {
        if (this.sessionId === undefined) {
            throw new Error("Session not open, cannot close session!")
        }

        const emptyMessageFrameList = new Uint8List()
        emptyMessageFrameList.push16(this.endpointId)
        emptyMessageFrameList.push8(MessageFlags.Close)
        emptyMessageFrameList.push32(this.sessionId)
        this.router.webSocket.send(emptyMessageFrameList)
    }
}

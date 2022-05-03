import IsomorphicWebSocket from './websocket'
import Uint8List from '../encoder/uint8list'
import IncomingMessageQueue from './queue'

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
    Data = 0,
    ClientSessionRequest = 1,
    ServerSessionAck = 2,
    Close = 3,
    CloseAck = 4,
    ErrorClientID = 5,
    ErrorSessionID = 6,
}

export class WebSocketRoute {
    private readonly router: WebSocketRouter
    private readonly endpointId: number
    private sessionId: number | undefined
    private readonly clientId: number
    private static usedClientIds: number[] = []
    private readonly messageQueue: IncomingMessageQueue<Uint8List | boolean>
    private readonly cancelSubscription: () => void
    constructor(router: WebSocketRouter, id: number) {
        this.router = router

        // id must be an unsigned 16-bit number
        if (id > 65535 || id < 0) {
            throw new Error("id must be an unsigned 16-bit number")
        }
        this.endpointId = id

        this.clientId = 0
        for (let i = 0; i <= 0xffffffff; i++) {
            if (!WebSocketRoute.usedClientIds.includes(i)) {
                this.clientId = i
                break
            }

            if (i + 1 > 0xffffffff) {
                throw new Error("no more client IDs left")
            }
        }
        WebSocketRoute.usedClientIds.push(this.clientId)

        this.messageQueue = new IncomingMessageQueue()
        this.cancelSubscription = this.router.webSocket.listen((open, data, error) => {
            if (!open) {
                this.cancelSubscription()
                this.messageQueue.newMessage(false)
                return
            }

            if (error) {
                throw new Error(error)
            }

            if (data) {
                this.messageQueue.newMessage(data)
            }
        })
    }

    get isOpen() {
        return this.sessionId !== undefined
    }

    /**
     * Session establishment messages have a slightly different format:
     *
     * | Endpoint ID (16 bits) | Request flag (8 bits) = MessageFlags.ClientSessionRequest | Client ID (32 bits) |
     *
     * The server will send the client ID back as-is so the client can identify which session establishment request
     * it's responding too. However, this won't be the session ID — the server will generate that and include it
     * in the response as follows:
     *
     * | Endpoint ID (16 bits) | Request flag (8 bits) = MessageFlags.ServerSessionAck | Client ID (32 bits) | Session ID (32 bits) |
     */
    async open() {
        const openMessageList = new Uint8List()
        openMessageList.push16(this.endpointId)
        openMessageList.push8(MessageFlags.ClientSessionRequest)
        openMessageList.push32(this.clientId)
        this.router.webSocket.send(openMessageList)

        const promises: Promise<number>[] = [this.receiveSessionAcknowledgement()]
        if (this.router.connectionTimeout !== 0) {
            promises.push(new Promise<number>(resolve => {
                setTimeout(() => {
                    resolve(-1)
                }, this.router.connectionTimeout)
            }))
        }
        const response = await Promise.race(promises)

        if (response === -1) {
            throw new Error("Session establishment timed out")
        }

        const usedIdIndex = WebSocketRoute.usedClientIds.indexOf(this.clientId)
        WebSocketRoute.usedClientIds.splice(usedIdIndex, 1)
        this.sessionId = response
    }

    /**
     * Format for messages:
     * | Endpoint ID (16 bits) | Request flag (8 bits) | Session ID (32 bits) | Encoded Unit |
     *
     * Format for errors:
     * | Endpoint ID (16 bits) | Request flag (8 bits) = MessageFlags.Error[ClientID][SessionID] | Session ID or Client ID (32 bits) | Binary-encoded string error message
     *
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

        let connectionOpen = true
        while (connectionOpen) {
            const message = await this.messageQueue.next()
            if (message === false) {
                connectionOpen = false
                continue
            } else if (typeof message === 'boolean') {
                continue
            }

            const endpointId = message.read16()
            if (endpointId !== this.endpointId) {
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

            if (requestFlag === MessageFlags.ErrorClientID || requestFlag === MessageFlags.ErrorSessionID) {
                const sessionOrClientId = message.read32()
                if (requestFlag === MessageFlags.ErrorClientID && this.clientId !== sessionOrClientId) {
                    continue
                }
                if (requestFlag === MessageFlags.ErrorSessionID && this.sessionId !== sessionOrClientId) {
                    continue
                }

                const errorMessage = message.sliceToEnd().toString()
                throw new Error("ServerError: " + errorMessage)
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

        this.cancelSubscription()
    }
}

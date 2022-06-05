import type NodeWebSocket from 'ws'
import Uint8List from '../encoder/uint8list.js'
import IncomingMessageQueue from './queue.js'
import isNode from 'detect-node'

export enum WebSocketState {
    Connecting,
    Ready,
    Closing,
    Closed,
}

// an isomorphic WebSocket provider that works both on Node.JS and web
// uses generators for events rather than callbacks
export default class IsomorphicWebSocket {
    private readonly nodeWs: NodeWebSocket | undefined
    private readonly webWs: WebSocket | undefined
    private readonly url: string
    private readonly cancelErrorListener: () => void
    constructor(url: string) {
        this.url = url

        if (isNode) {
            // yes, this is a real thing.
            // Webpack will try to import everything it ever sees, and this will stop it
            // Importing ws into a browser will cause all sorts of issues
            const requireFunction = typeof __webpack_require__ === "function" ? __non_webpack_require__ : require;
            const WebSocket = requireFunction('ws')

            this.nodeWs = new WebSocket(this.url, {
                perMessageDeflate: false,
            }) as NodeWebSocket

            this.nodeWs.binaryType = 'arraybuffer'
            this.nodeWs.addEventListener("message", this.handleMessageReceive.bind(this))
            this.nodeWs.setMaxListeners(Infinity)
        } else {
            this.webWs = new WebSocket(this.url)
            this.webWs.binaryType = 'arraybuffer'
            this.webWs.addEventListener("message", this.handleMessageReceive.bind(this))
        }

        // automatically close the WebSocket when an error occurs
        this.cancelErrorListener = this.listenForErrors(() => {
            this.close()
        })
    }

    get ws() {
        if (this.nodeWs) {
            return this.nodeWs
        } else if (this.webWs) {
            return this.webWs
        } else {
            throw new Error("tried to access uninitialised websocket")
        }
    }

    get isReady() {
        return this.ws.readyState === WebSocketState.Ready
    }

    waitForConnection() {
        return new Promise<void>((resolve, reject) => {
            const removeListeners = () => {
                if (this.webWs) {
                    this.webWs.removeEventListener("open", successHandler)
                    this.webWs.removeEventListener("error", failHandler)
                } else if (this.nodeWs) {
                    this.nodeWs.removeEventListener("open", successHandler)
                    this.nodeWs.removeEventListener("error", failHandler)
                }
            }

            const successHandler = () => {
                removeListeners()
                resolve()
            }

            const failHandler = (e: NodeWebSocket.ErrorEvent | Event) => {
                removeListeners()
                if ('error' in e) {
                    reject(new Error(e.error))
                } else {
                    reject(new Error("Couldn't open WebSocket connection: Connection to server failed."))
                }
            }

            if (this.webWs) {
                if (this.webWs.readyState === WebSocketState.Ready) {
                    resolve()
                    return
                } else if (this.webWs.readyState === WebSocketState.Closed) {
                    reject(new Error("WebSocket is closed"))
                    return
                }

                this.webWs.addEventListener("open", successHandler)
                this.webWs.addEventListener("error", failHandler)
            } else if (this.nodeWs) {
                if (this.nodeWs.readyState === WebSocketState.Ready) {
                    resolve()
                    return
                } else if (this.nodeWs.readyState === WebSocketState.Closed) {
                    reject(new Error("WebSocket is closed"))
                    return
                }

                this.nodeWs.addEventListener("open", successHandler)
                this.nodeWs.addEventListener("error", failHandler)
            }
        })
    }

    private incomingMessageQueue = new IncomingMessageQueue()
    private handleMessageReceive(e: {data: any}) {
        this.incomingMessageQueue.newMessage(e.data)
    }

    private listenForMessages(handler: (data: Uint8List) => void): () => void {
        return this.incomingMessageQueue.listen(rawMessage => {
            if (rawMessage instanceof ArrayBuffer) {
                handler(Uint8List.fromArrayBuffer(rawMessage))
            }
        })
    }

    private listenForErrors(handler: (error: string) => void): () => void {
        return this.incomingMessageQueue.listen(rawMessage => {
            if (typeof rawMessage === 'string') {
                handler(rawMessage)
            }
        })
    }

    private listenForClose(handler: () => void): () => void {
        if (this.nodeWs) {
            this.nodeWs.addEventListener('close', handler)
            return () => {
                this.nodeWs!.removeEventListener('close', handler)
            }
        } else if (this.webWs) {
            this.webWs.addEventListener('close', handler)
            return () => {
                this.webWs!.removeEventListener('close', handler)
            }
        } else {
            throw new Error("no websocket")
        }
    }

    listen(handler: (connectionOpen: boolean, data?: Uint8List, error?: string) => void): () => void {
        if (this.ws.readyState !== WebSocketState.Ready) {
            throw new Error("websocket not ready")
        }

        const messageUnsubscribe = this.listenForMessages(data => {
            handler(true, data)
        })
        const errorUnsubscribe = this.listenForErrors(error => {
            // connectionOpen = uncertain, as the listenForErrors() called in the constructor may have taken precedence
            // and already closed the connection. If not, another call to handler() will be made after this one when
            // the listenForClose() handler is called.
            handler(this.ws.readyState === WebSocketState.Ready, undefined, error)
        })
        const closeUnsubscribe = this.listenForClose(() => {
            handler(false)
        })

        return () => {
            messageUnsubscribe()
            errorUnsubscribe()
            closeUnsubscribe()
        }
    }

    send(data: Uint8List) {
        this.ws.send(data.uint8Array.buffer)
    }

    close() {
        this.ws.close()
        this.cancelErrorListener()
    }
}

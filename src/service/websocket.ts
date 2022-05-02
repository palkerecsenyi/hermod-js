import NodeWebSocket from 'ws';
import Uint8List from '../encoder/uint8list';
import IncomingMessageQueue from './queue'

// an isomorphic WebSocket provider that works both on Node.JS and web
// uses generators for events rather than callbacks
export default class IsomorphicWebSocket {
    private readonly nodeWs: NodeWebSocket | undefined;
    private readonly webWs: WebSocket | undefined;
    constructor(url: string) {
        if (typeof window !== "undefined") {
            this.webWs = new WebSocket(url)
            this.webWs.binaryType = 'arraybuffer'
            this.webWs.addEventListener("message", this.handleMessageReceive.bind(this))
        } else {
            this.nodeWs = new NodeWebSocket(url, {
                perMessageDeflate: false,
            })
            this.nodeWs!.binaryType = 'arraybuffer'
            this.nodeWs!.addEventListener("message", this.handleMessageReceive.bind(this))
        }
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
                reject(new Error("Connection to the server failed"))
            }

            if (this.webWs) {
                if (this.webWs.readyState === 1) {
                    resolve()
                    return
                } else if (this.webWs.readyState === 3) {
                    reject(new Error("WebSocket is closed"))
                    return
                }

                this.webWs.addEventListener("open", successHandler)
                this.webWs.addEventListener("error", failHandler)
            } else if (this.nodeWs) {
                if (this.nodeWs.readyState === 1) {
                    resolve()
                    return
                } else if (this.nodeWs.readyState === 3) {
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

    private async binaryProvider(): Promise<Uint8List> {
        const data = await this.incomingMessageQueue.next()
        if (data instanceof ArrayBuffer) {
            return Uint8List.fromArrayBuffer(data)
        // a string response is usually a sign of a server-side error
        } else if (typeof data === 'string') {
            throw new Error(data)
        }

        throw new Error("type wasn't ArrayBuffer")
    }

    private async textProvider(): Promise<Uint8List> {
        const data = await this.incomingMessageQueue.next()
        if (typeof data === 'string') {
            return Uint8List.fromString(data)
        }

        throw new Error("type wasn't string")
    }

    private async *receive(provider: () => Promise<Uint8List>) {
        const ws = this.nodeWs ?? this.webWs
        if (ws === undefined) return
        while (ws.readyState === 1) {
            yield await provider()
        }
    }

    async *message() {
        yield* this.receive(this.binaryProvider.bind(this))
    }

    async *error(): AsyncGenerator<string> {
        for await (const error of this.receive(this.textProvider)) {
            yield error.toString()
        }
    }

    send(data: Uint8List) {
        if (this.webWs) {
            this.webWs.send(data.uint8Array.buffer)
        } else if (this.nodeWs) {
            this.nodeWs.send(data.uint8Array.buffer)
        }
    }

    close() {
        if (this.webWs) {
            this.webWs.close()
        } else if (this.nodeWs) {
            this.nodeWs.close()
        }
    }
}

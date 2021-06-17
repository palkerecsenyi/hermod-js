import type NodeWebSocket from 'ws';
import Uint8List from '../encoder/uint8list';

// an isomorphic WebSocket provider that works both on Node.JS and web
// uses generators for events rather than callbacks
export default class IsomorphicWebSocket {
    private readonly nodeWs: NodeWebSocket | undefined;
    private readonly webWs: WebSocket | undefined;
    constructor(url: string) {
        if (WebSocket) {
            this.webWs = new WebSocket(url)
            this.webWs.binaryType = 'arraybuffer'
        } else {
            const ws = require('ws')
            this.nodeWs = new ws.WebSocket(url, {
                perMessageDeflate: false,
            })
            this.nodeWs!.binaryType = 'arraybuffer'
        }
    }

    private wsReceiveOnce(): Promise<any> {
        return new Promise(resolve => {
            const handler = (e: {data: any}) => {
                if (this.webWs) {
                    this.webWs.removeEventListener('message', handler)
                } else if (this.nodeWs) {
                    this.nodeWs.removeEventListener('message', handler)
                }

                resolve(e.data)
            }

            if (this.webWs) {
                this.webWs.addEventListener('message', handler)
            } else if (this.nodeWs) {
                this.nodeWs.addEventListener('message', handler)
            }
        })
    }

    private async binaryProvider(): Promise<Uint8List> {
        const data = await this.wsReceiveOnce()
        if (data instanceof ArrayBuffer) {
            return Uint8List.fromArrayBuffer(data)
        }

        throw new Error("type wasn't ArrayBuffer")
    }

    private async textProvider(): Promise<Uint8List> {
        const data = await this.wsReceiveOnce()
        if (typeof data === 'string') {
            return Uint8List.fromString(data)
        }

        throw new Error("type wasn't string")
    }

    private async *receive(provider: () => Promise<Uint8List>) {
        const ws = this.nodeWs ?? this.webWs
        if (ws === undefined) return
        while (ws.readyState === 3) {
            try {
                yield await provider()
            } catch (e) {}
        }
    }

    async *message() {
        yield* this.receive(this.binaryProvider)
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

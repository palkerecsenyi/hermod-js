import { Unit } from '../encoder/encoder.js';
import { decodeUFHU, encodeUFHU, UserFacingHermodUnit } from '../encoder/user.js';
import { GlobalServer } from './request.js';
import type WebSocketRoute from './route.js'
import type WebSocketRouter from './router.js'

/**
 * ServiceReadWriter is the way to interact with a high-level request to a particular Hermod endpoint. The three main
 * provided functions are send(), read(), and readNext().
 *
 * When instantiating ServiceReadWriter, the handshake process won't be started and the session won't be opened.
 * However, this is done automatically when calling any of send(), read(), or readNext().
 */
export default class ServiceReadWriter<In extends UserFacingHermodUnit | undefined = undefined, Out extends UserFacingHermodUnit | undefined = undefined> {
    private readonly in: Unit | undefined
    private readonly out: Unit | undefined
    private readonly client: WebSocketRoute
    constructor(
        id: number,
        router?: WebSocketRouter,
        inDefinition?: Unit,
        outDefinition?: Unit,
    ) {
        this.in = inDefinition
        this.out = outDefinition

        if (!router && !GlobalServer.connection) {
            throw new Error("GlobalServer router not found. Use GlobalServer.set() to set one or pass the optional `router` parameter.")
        }

        const selectedRouter = router ?? GlobalServer.connection
        this.client = selectedRouter.getRoute(id)
    }

    close() {
        this.client.close()
    }

    /**
     * If a handshake hasn't already been completed, perform one now. Returns a Promise that resolves when the handshake
     * has successfully completed and rejects if it times out (based on router.connectionTimeout).
     */
    async open() {
        if (!this.client.handshakeComplete) {
            await this.client.open()
        }
    }

    async *read(): AsyncGenerator<Out, void, void> {
        await this.open()
        for await (const rawData of this.client.receive()) {
            if (this.out !== undefined) {
                yield decodeUFHU(rawData, this.out) as Out
            }
        }
    }

    async readNext(): Promise<Out> {
        if (this.out === undefined) throw new Error("function doesn't return any arguments. use read() instead.")

        await this.open()
        const receiver = this.client.receive()
        const rawData = await receiver.next()
        if (rawData.value === undefined) {
            throw new Error("Connection got closed while waiting for next message")
        }
        await receiver.return()

        return decodeUFHU(rawData.value, this.out) as Out
    }

    async send(data: In): Promise<void> {
        if (this.in === undefined && data !== undefined) throw new Error("function doesn't take any arguments")

        await this.open()
        if (this.in !== undefined && data !== undefined) {
            const encodedData = encodeUFHU(data as UserFacingHermodUnit, this.in)
            this.client.send(encodedData)
        }
    }
}

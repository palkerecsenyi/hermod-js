import { Unit } from '../encoder/encoder';
import { decodeUFHU, encodeUFHU, UserFacingHermodUnit } from '../encoder/user';
import { GlobalServer } from './request';
import type WebSocketRoute from './route'
import type WebSocketRouter from './router'

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

    private async open() {
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

import { Unit } from '../encoder/encoder';
import { decodeUFHU, encodeUFHU, UserFacingHermodUnit } from '../encoder/user';
import { GlobalServer } from './request';
import { WebSocketRoute, WebSocketRouter } from './router'

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
        if (!this.client.isOpen) {
            await this.client.open()
        }
    }

    async *read(): AsyncGenerator<Out, void, void> {
        if (this.out === undefined) throw new Error("function doesn't return any arguments")

        await this.open()
        for await (const rawData of this.client.receive()) {
            yield decodeUFHU(rawData, this.out) as Out
        }
    }

    async readNext(): Promise<Out> {
        if (this.out === undefined) throw new Error("function doesn't return any arguments")

        await this.open()
        const rawData = await this.client.receive().next()
        if (!rawData.value) {
            throw new Error("connection got closed")
        }
        return decodeUFHU(rawData.value, this.out) as Out
    }

    async send(data: In): Promise<void> {
        if (this.in === undefined) throw new Error("function doesn't take any arguments")

        await this.open()
        const encodedData = encodeUFHU(data as UserFacingHermodUnit, this.in)
        this.client.send(encodedData)
    }
}

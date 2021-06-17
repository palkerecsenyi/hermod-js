import { Unit } from '../encoder/encoder';
import { decodeUFHU, encodeUFHU, UserFacingHermodUnit } from '../encoder/user';
import IsomorphicWebSocket from './websocket';

export default class ServiceReadWriter<In extends UserFacingHermodUnit | undefined = undefined, Out extends UserFacingHermodUnit | undefined = undefined> {
    private readonly in: Unit | undefined
    private readonly out: Unit | undefined
    private readonly client: IsomorphicWebSocket
    constructor(client: IsomorphicWebSocket, inDefinition?: Unit, outDefinition?: Unit) {
        this.in = inDefinition
        this.out = outDefinition
        this.client = client
    }

    close() {
        this.client.close()
    }

    async *read(): AsyncGenerator<Out, void, void> {
        if (this.in === undefined) throw new Error("function doesn't return any arguments")
        for await (const rawData of this.client.message()) {
            yield decodeUFHU(rawData, this.in) as Out
        }
    }

    async send(data: In): Promise<void> {
        if (this.out === undefined) throw new Error("function doesn't take any arguments")
        const encodedData = encodeUFHU(data as UserFacingHermodUnit, this.out)
        this.client.send(encodedData)
    }
}

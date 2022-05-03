import Queue from 'yocto-queue'
import EventEmitter, { once } from 'events'

type CancelHandler = () => void

export default class IncomingMessageQueue<MessageType = any> {
    private readonly eventEmitter: EventEmitter
    private queue: Queue<any>
    constructor() {
        this.eventEmitter = new EventEmitter()

        // By default, EventEmitters have a limit of 10 listeners per event
        // Hermod uses a single event 'message' which can have a very large amount of
        // listeners, so this limit doesn't make sense.
        this.eventEmitter.setMaxListeners(Infinity)
        this.queue = new Queue<MessageType>()
    }

    newMessage(data: MessageType) {
        this.queue.enqueue(data)
        this.eventEmitter.emit('message', data)
    }

    // resolves when some data is available
    private async wait() {
        if (this.queue.size > 0) {
            return
        }

        await once(this.eventEmitter, 'message')
    }

    private async waitProtected() {
        while (this.queue.size === 0) {
            await this.wait()
        }
    }

    /**
     * Get the next item in the queue.
     *
     * If there are no items in the queue, wait until one arrives and return that.
     */
    async next(): Promise<MessageType> {
        await this.waitProtected()
        return this.queue.dequeue()
    }

    /**
     * Listen for messages in order of arrival, independent of the queue system
     * @param handler called each time a message arrived
     * @returns call this to cancel the listener
     */
    listen(handler: (data: MessageType) => any): CancelHandler {
        const eventHandler = (data: any) => {
            if (data !== undefined) {
                handler(data)
            }
        }

        this.eventEmitter.addListener('message', eventHandler)
        return () => {
            this.eventEmitter.removeListener('message', eventHandler)
        }
    }
}

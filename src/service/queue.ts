import { BehaviorSubject } from 'rxjs'
import Queue from 'yocto-queue'

export default class IncomingMessageQueue {
    private subject: BehaviorSubject<number>
    private queue: Queue<any>
    constructor() {
        this.subject = new BehaviorSubject<number>(0)
        this.queue = new Queue<any>()
    }

    newMessage(data: any) {
        this.queue.enqueue(data)

        const val = this.subject.getValue() + 1 % 8
        this.subject.next(val)
    }

    async next() {
        if (this.queue.size > 0) {
            return this.queue.dequeue()
        }

        return new Promise<any>(resolve => {
            const subscription = this.subject.subscribe(() => {
                if (this.queue.size === 0) return
                resolve(this.queue.dequeue())
                subscription.unsubscribe()
            })
        })
    }
}

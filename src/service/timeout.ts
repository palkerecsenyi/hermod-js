export class TimeoutError {
    readonly name = "TimeoutError"
    readonly message = "Operation timed out"
}

export async function runWithTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    const promises = [promise]

    if (timeout !== 0) {
        promises.push(new Promise((_, reject) => {
            setTimeout(() => {
                reject(new TimeoutError())
            }, timeout)
        }))
    }

    return Promise.race<T>(promises)
}

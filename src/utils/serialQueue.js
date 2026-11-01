// Serializes async work in call order: each task starts after the previous one
// settles, and a failed task never blocks the queue.
export const createSerialQueue = () => {
    let pending = Promise.resolve()
    return action => {
        const result = pending.then(action)
        pending = result.catch(() => {})
        return result
    }
}

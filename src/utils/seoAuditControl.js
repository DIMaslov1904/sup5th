export const createAuditControl = signal => {
    let paused = false
    const waiters = new Set()
    return {
        pause: () => { paused = true },
        resume: () => { paused = false; for (const release of [...waiters]) release() },
        waitForResume: async () => {
            signal?.throwIfAborted()
            while (paused) {
                signal?.throwIfAborted()
                await new Promise((resolve, reject) => {
                    const cleanup = () => { waiters.delete(release); signal?.removeEventListener('abort', abort) }
                    const release = () => { cleanup(); resolve() }
                    const abort = () => { cleanup(); reject(signal.reason) }
                    waiters.add(release); signal?.addEventListener('abort', abort, { once: true })
                })
            }
            signal?.throwIfAborted()
        }
    }
}

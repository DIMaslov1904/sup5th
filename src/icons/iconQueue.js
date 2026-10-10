import { ICON_RETRY_DELAY } from './iconPolicy.js'

const emptyQueue = () => ({ pending: [], targets: [], total: 0, completed: 0, failed: 0, runId: '' })

// Network work runs outside the state lock; cancellation invalidates its result.
export const createIconQueue = ({ repository, fetchIcon, schedule, notify, now = Date.now }) => {
    let pendingMutation = Promise.resolve(), running = null, controller = null
    const serial = action => {
        const result = pendingMutation.then(action)
        pendingMutation = result.catch(() => {})
        return result
    }
    const status = async () => {
        const state = await repository.getState() || emptyQueue()
        return { active: state.pending.length > 0, total: state.total, completed: state.completed, failed: state.failed }
    }
    const announce = async origin => notify({ ...(await status()), origin })
    const reconcile = (targets, { force = false } = {}) => serial(async () => {
        const state = await repository.getState() || emptyQueue()
        const records = await repository.list()
        for (const record of records) if (!targets.includes(record.origin)) await repository.remove(record.origin)
        const needed = targets.filter(origin => {
            const record = records.find(item => item.origin === origin)
            return force || (!record?.image && !(record?.retryAfter > now()))
        })
        if (force) controller?.abort()
        const retained = force ? [] : state.pending.filter(origin => targets.includes(origin))
        const additions = needed.filter(origin => !retained.includes(origin))
        const next = {
            ...state, targets, pending: [...retained, ...additions],
            ...(force || !state.pending.length ? { total: needed.length, completed: 0, failed: 0, runId: crypto.randomUUID() } : { total: state.total + additions.length })
        }
        await repository.setState(next)
        await schedule(next.pending.length > 0)
        await announce()
        return status()
    })
    const cancel = () => serial(async () => {
        controller?.abort()
        const state = await repository.getState() || emptyQueue()
        await repository.setState({ ...state, pending: [], runId: crypto.randomUUID() })
        await schedule(false)
        await announce()
        return status()
    })
    const processNext = async () => {
        const job = await serial(async () => {
            const state = await repository.getState() || emptyQueue()
            return state.pending.length ? { origin: state.pending[0], runId: state.runId } : null
        })
        if (!job) return false
        controller = new AbortController()
        let result, failure
        try { result = await fetchIcon(job.origin, controller.signal) }
        catch (error) { failure = error }
        await serial(async () => {
            const state = await repository.getState() || emptyQueue()
            if (state.runId !== job.runId || !state.pending.includes(job.origin)) return
            const previous = await repository.get(job.origin)
            try {
                await repository.put({
                    origin: job.origin, ...(previous || {}), ...(result || {}),
                    updatedAt: now(), retryAfter: failure ? now() + ICON_RETRY_DELAY : 0,
                    error: failure ? String(failure.message).slice(0, 200) : ''
                })
            } catch (error) { failure = error }
            await repository.setState({ ...state, pending: state.pending.filter(origin => origin !== job.origin), completed: state.completed + 1, failed: state.failed + Number(Boolean(failure)) })
            await announce(job.origin)
        })
        controller = null
        return true
    }
    const drain = () => {
        if (running) return running
        running = (async () => {
            while (await processNext()) { /* pacing is applied to every HTTP request by fetchIcon */ }
            await schedule(false)
        })().finally(() => { running = null })
        return running
    }
    return { reconcile, cancel, status, drain }
}

import { ICON_RETRY_DELAY } from './iconPolicy.js'
import { createSerialQueue } from '../utils/serialQueue.js'

const emptyQueue = () => ({ pending: [], total: 0, completed: 0, failed: 0, runId: '' })

// Network work runs outside the state lock; cancellation invalidates its result.
export const createIconQueue = ({ repository, fetchIcon, schedule, notify, now = Date.now }) => {
    let running = null, controller = null
    const serial = createSerialQueue()
    const status = async () => {
        const state = await repository.getState() || emptyQueue()
        return { active: state.pending.length > 0, total: state.total, completed: state.completed, failed: state.failed }
    }
    const announce = async (change = {}) => notify({ ...(await status()), ...change })
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
            ...state, pending: [...retained, ...additions],
            ...(force || !state.pending.length ? { total: needed.length, completed: 0, failed: 0, runId: crypto.randomUUID() } : { total: state.total + additions.length })
        }
        await repository.setState(next)
        await schedule(next.pending.length > 0)
        await announce()
        return status()
    })
    const refresh = origin => serial(async () => {
        const state = await repository.getState() || emptyQueue()
        if (state.pending[0] === origin) return
        const alreadyPending = state.pending.includes(origin)
        await repository.setState({
            ...state, pending: [origin, ...state.pending.filter(item => item !== origin)],
            ...(state.pending.length
                ? { total: state.total + Number(!alreadyPending) }
                : { total: 1, completed: 0, failed: 0, runId: crypto.randomUUID() })
        })
        await schedule(true)
        await announce()
    })
    const cancel = () => serial(async () => {
        controller?.abort()
        const state = await repository.getState() || emptyQueue()
        await repository.setState({ ...state, pending: [], runId: crypto.randomUUID() })
        await schedule(false)
        await announce({ cancelled: true })
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
                    retryAfter: failure ? now() + ICON_RETRY_DELAY : 0
                })
            } catch (error) { failure = error }
            await repository.setState({ ...state, pending: state.pending.filter(origin => origin !== job.origin), completed: state.completed + 1, failed: state.failed + Number(Boolean(failure)) })
            await announce({ origin: job.origin, succeeded: !failure })
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
    return { reconcile, refresh, cancel, status, drain }
}

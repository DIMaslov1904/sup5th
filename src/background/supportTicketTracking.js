import { mutateStorage, storageGet, storageSet } from './storageRepository.js'
import { SUPPORT_TRACKING_KEY, SUPPORT_TIMER_ALARM, activeTicketFrom } from '../utils/supportTimer.js'
import { setTicketTimerBadge, updateBadgeForTab } from './actionBadge.js'

export const getActiveSupportTicket = async () => activeTicketFrom(await storageGet(SUPPORT_TRACKING_KEY))

export const observeSupportTicket = payload => mutateStorage(async () => {
    const { ticketId, state, confirmedStart } = payload
    if (typeof ticketId !== 'string' || !/^[1-9]\d{0,11}$/.test(ticketId) || !['active', 'inactive'].includes(state)) throw new Error('Некорректное состояние тикета')
    const saved = await storageGet(SUPPORT_TRACKING_KEY, {}), active = activeTicketFrom(saved)
    let dismissed = saved.dismissed || []
    if (state === 'inactive') {
        dismissed = dismissed.filter(id => id !== ticketId)
        if (active?.ticketId !== ticketId && dismissed.length === (saved.dismissed || []).length) return active
        await storageSet(SUPPORT_TRACKING_KEY, { active: active?.ticketId === ticketId ? null : active, dismissed })
        return null
    }
    if (dismissed.includes(ticketId) && !confirmedStart) return active
    if (active && active.ticketId !== ticketId && !confirmedStart) return active
    const logStart = payload.source === 'log' && Number.isFinite(payload.startedAt) && payload.startedAt > 0
    const start = Number.isFinite(payload.startedAt) && payload.startedAt > 0 ? Math.min(payload.startedAt, Date.now()) : Date.now()
    const changedLog = logStart && (active?.source !== 'log' || active.startedAt !== start)
    if (active?.ticketId === ticketId && !confirmedStart && !changedLog) return active
    const next = { ticketId, startedAt: start, source: logStart ? 'log' : payload.source === 'click' ? 'click' : 'observed' }
    await storageSet(SUPPORT_TRACKING_KEY, { active: next, dismissed: dismissed.filter(id => id !== ticketId) })
    return next
})

export const resetActiveSupportTicket = () => mutateStorage(async () => {
    const saved = await storageGet(SUPPORT_TRACKING_KEY, {}), active = activeTicketFrom(saved)
    const dismissed = [...new Set([...(saved.dismissed || []), ...(active ? [active.ticketId] : [])])].slice(-50)
    await storageSet(SUPPORT_TRACKING_KEY, { active: null, dismissed })
    return null
})

const refreshTimer = async () => {
    const active = await getActiveSupportTicket()
    if (active) {
        if (!await chrome.alarms.get(SUPPORT_TIMER_ALARM)) await chrome.alarms.create(SUPPORT_TIMER_ALARM, { periodInMinutes: 1 })
    } else await chrome.alarms.clear(SUPPORT_TIMER_ALARM)
    if (active) await setTicketTimerBadge(undefined, active)
    else {
        await chrome.action.setBadgeText({ text: '' })
        await chrome.action.setTitle({ title: chrome.runtime.getManifest().name })
    }
    const tabs = await chrome.tabs.query({})
    await Promise.allSettled(tabs.filter(tab => Number.isInteger(tab.id)).map(tab => active ? setTicketTimerBadge(tab.id, active) : updateBadgeForTab(tab.id)))
}

export const registerSupportTicketTracking = ready => {
    let pending = Promise.resolve()
    const refresh = () => {
        pending = pending.then(refreshTimer).catch(error => console.error('[support] timer badge', error))
        return pending
    }
    chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === SUPPORT_TIMER_ALARM) refresh() })
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes[SUPPORT_TRACKING_KEY]) refresh()
    })
    ready.then(refresh).catch(console.error)
}

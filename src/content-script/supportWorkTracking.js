import { applyWorkDefaults, readSupportWorkState, workLogText } from './supportWorkState.js'

const observedDocuments = new WeakSet()

export const startSupportWorkTracking = targetDoc => {
    if (observedDocuments.has(targetDoc)) return
    observedDocuments.add(targetDoc)
    const initialized = new WeakSet()
    let pendingStart = null, lastSignature = '', timer, sending = Promise.resolve()

    const check = () => {
        const wrapper = targetDoc.querySelector('#ticket-wrapper')
        if (!wrapper) return
        applyWorkDefaults(wrapper, initialized)
        const state = readSupportWorkState(wrapper)
        if (!state) return
        if (pendingStart && (pendingStart.ticketId !== state.ticketId || Date.now() - pendingStart.at > 120000)) pendingStart = null
        const log = workLogText(wrapper)
        const confirmedStart = state.state === 'active' && Boolean(pendingStart)
            && log !== pendingStart.log && (/приступил к работе/i.test(log) || state.source === 'log')
        if (pendingStart && state.state === 'active' && !confirmedStart) return
        if (confirmedStart && (state.startedAt === null || state.startedAt < pendingStart.at - 120000)) {
            state.startedAt = pendingStart.at
            state.source = 'click'
        }
        const signature = JSON.stringify(state)
        if (signature === lastSignature && !confirmedStart) return
        lastSignature = signature
        if (confirmedStart) pendingStart = null
        const payload = { ...state, confirmedStart, observedAt: Date.now() }
        sending = sending.then(async () => {
            const response = await chrome.runtime.sendMessage({ type: 'support:ticket:observe', payload })
            if (!response?.ok) throw new Error(response?.error || 'Не удалось сохранить состояние тикета')
        }).catch(error => {
            lastSignature = ''
            console.warn('[support] ticket tracking', error)
        })
    }
    const schedule = () => {
        clearTimeout(timer)
        timer = setTimeout(check, 150)
    }
    targetDoc.addEventListener('click', event => {
        const play = event.target?.closest?.('#button_play')
        if (!play || play.disabled) return
        const wrapper = play.closest('#ticket-wrapper'), state = readSupportWorkState(wrapper)
        if (!state) return
        pendingStart = { ticketId: state.ticketId, at: Date.now(), log: workLogText(wrapper) }
    }, true)
    targetDoc.addEventListener('visibilitychange', () => { if (!targetDoc.hidden) schedule() })
    new MutationObserver(schedule).observe(targetDoc.documentElement, {
        childList: true, subtree: true, characterData: true, attributes: true,
        attributeFilter: ['disabled', 'aria-disabled']
    })
    check()
}

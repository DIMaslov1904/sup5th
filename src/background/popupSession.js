import { extensionApi } from '../platform/extensionApi.js'
import { POPUP_PORT_NAME, POPUP_STATE_KEY, POPUP_RETENTION_MS, closedPopupState, defaultPopupState, normalizePopupState, restorePopupState } from '../utils/popupState.js'
import { POPUP_EXPIRY_ALARM, SEO_SESSION_KEY, seoContextKey } from '../utils/seoSessionState.js'
import { storageReady } from './storageRepository.js'

// Serialize reconnects so a new popup reads the previous disconnect's snapshot.
export const registerPopupSession = () => {
    let pending = Promise.resolve()
    const ports = new Set()
    const enqueue = (action) => {
        pending = pending.then(() => storageReady).then(action).catch((error) => console.error('[popup] session state', error))
    }

    const readSeo = async () => {
        const saved = (await extensionApi.storage.session.get(SEO_SESSION_KEY))[SEO_SESSION_KEY] || {}
        return Object.fromEntries(Object.entries(saved).filter(([, entry]) => !entry.expiresAt || entry.expiresAt > Date.now()))
    }
    const writeSeo = async entries => {
        // Оставляем запас в session storage для прочего состояния расширения.
        while (new TextEncoder().encode(JSON.stringify(entries)).length > 8 * 1024 * 1024) {
            const oldest = Object.keys(entries).sort((a, b) => entries[a].updatedAt - entries[b].updatedAt)[0]
            delete entries[oldest]
        }
        if (Object.keys(entries).length) await extensionApi.storage.session.set({ [SEO_SESSION_KEY]: entries })
        else await extensionApi.storage.session.remove(SEO_SESSION_KEY)
    }
    const expire = async () => {
        const saved = (await extensionApi.storage.session.get(POPUP_STATE_KEY))[POPUP_STATE_KEY]
        if (saved?.expiresAt <= Date.now()) await extensionApi.storage.session.remove(POPUP_STATE_KEY)
        await writeSeo(await readSeo())
    }
    extensionApi.alarms.onAlarm.addListener(alarm => {
        if (alarm.name === POPUP_EXPIRY_ALARM) enqueue(expire)
    })

    extensionApi.runtime.onConnect.addListener((port) => {
        if (port.name !== POPUP_PORT_NAME) return
        if (port.sender?.id !== extensionApi.runtime.id || !port.sender?.url?.startsWith(extensionApi.runtime.getURL('src/popup/'))) {
            port.disconnect()
            return
        }
        let state = defaultPopupState()
        let disconnected = false
        ports.add(port)
        port.onMessage.addListener((message) => {
            if (message?.type === 'state') state = normalizePopupState(message.state)
            if (!['seo:get', 'seo:save'].includes(message?.type)) return
            enqueue(async () => {
                const entries = await readSeo(), key = seoContextKey(message.context)
                if (message.type === 'seo:get') {
                    if (!disconnected) port.postMessage({ type: 'seo:restore', requestId: message.requestId, state: entries[key]?.state || null })
                    return
                }
                if (!key || (!message.state?.report && !entries[key]?.state?.report)) return
                // Навигация/перезагрузка вкладки делает предыдущий документ неактуальным.
                for (const previous of Object.keys(entries)) {
                    if (entries[previous].context.tabId === message.context.tabId && previous !== key) delete entries[previous]
                }
                entries[key] = { context: message.context, state: { ...entries[key]?.state, ...message.state }, updatedAt: Date.now(), expiresAt: null }
                await writeSeo(entries)
            })
        })
        port.onDisconnect.addListener(() => {
            disconnected = true
            ports.delete(port)
            const closedAt = Date.now(), saved = closedPopupState(state, closedAt)
            enqueue(async () => {
                if (saved) await extensionApi.storage.session.set({ [POPUP_STATE_KEY]: saved })
                else await extensionApi.storage.session.remove(POPUP_STATE_KEY)
                if (ports.size) return
                const entries = await readSeo(), expiresAt = closedAt + POPUP_RETENTION_MS
                Object.values(entries).forEach(entry => { entry.expiresAt = expiresAt })
                await writeSeo(entries)
                if (saved || Object.keys(entries).length) await extensionApi.alarms.create(POPUP_EXPIRY_ALARM, { when: expiresAt })
            })
        })
        enqueue(async () => {
            try {
                await expire()
                await extensionApi.alarms.clear(POPUP_EXPIRY_ALARM)
                const entries = await readSeo()
                Object.values(entries).forEach(entry => { entry.expiresAt = null })
                await writeSeo(entries)
                const result = await extensionApi.storage.session.get(POPUP_STATE_KEY)
                state = restorePopupState(result[POPUP_STATE_KEY])
                await extensionApi.storage.session.remove(POPUP_STATE_KEY)
            } catch (error) {
                console.warn('[popup] restore state', error)
            }
            if (!disconnected) port.postMessage({ type: 'restore', state })
        })
    })
}

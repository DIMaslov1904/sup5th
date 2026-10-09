import { POPUP_PORT_NAME, POPUP_STATE_KEY, closedPopupState, defaultPopupState, normalizePopupState, restorePopupState } from '../utils/popupState.js'

// Serialize reconnects so a new popup reads the previous disconnect's snapshot.
export const registerPopupSession = () => {
    let pending = Promise.resolve()
    const enqueue = (action) => {
        pending = pending.then(action).catch((error) => console.error('[popup] session state', error))
    }

    chrome.storage.local.remove(POPUP_STATE_KEY).catch((error) => console.warn('[popup] legacy state cleanup', error))

    chrome.runtime.onConnect.addListener((port) => {
        if (port.name !== POPUP_PORT_NAME) return
        if (port.sender?.id !== chrome.runtime.id || !port.sender?.url?.startsWith(chrome.runtime.getURL('src/popup/'))) {
            port.disconnect()
            return
        }
        let state = defaultPopupState()
        let disconnected = false
        port.onMessage.addListener((message) => {
            if (message?.type === 'state') state = normalizePopupState(message.state)
        })
        port.onDisconnect.addListener(() => {
            disconnected = true
            const saved = closedPopupState(state)
            enqueue(() => saved
                ? chrome.storage.session.set({ [POPUP_STATE_KEY]: saved })
                : chrome.storage.session.remove(POPUP_STATE_KEY))
        })
        enqueue(async () => {
            try {
                const result = await chrome.storage.session.get(POPUP_STATE_KEY)
                state = restorePopupState(result[POPUP_STATE_KEY])
                await chrome.storage.session.remove(POPUP_STATE_KEY)
            } catch (error) {
                console.warn('[popup] restore state', error)
            }
            if (!disconnected) port.postMessage({ type: 'restore', state })
        })
    })
}

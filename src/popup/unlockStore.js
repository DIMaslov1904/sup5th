// Глобальный механизм разблокировки хранилища по требованию.
// ensureUnlocked(action) — если хранилище заблокировано, показывает модалку
// через системный аутентификатор и выполняет action после разблокировки.
import { reactive } from 'vue'
import {
    getCredentialSecurityStatus,
    unlockCredentialVaultWithHello
} from './data/projectData.js'
import { unlockWithBiometricFlow } from '../utils/biometricHello.js'

export const unlockState = reactive({
    visible: false,
    mode: 'hello',
    loading: false,
    error: ''
})

let settle = null

const showUnlock = (mode, { refreshAfterUnlock = true } = {}) => new Promise((resolve, reject) => {
    settle = { resolve, reject, refreshAfterUnlock, controller: new AbortController() }
    unlockState.mode = mode
    unlockState.loading = false
    unlockState.error = ''
    unlockState.visible = true
})

const isActive = (request) => settle === request && !request.controller.signal.aborted

const finishUnlock = (request) => {
    if (!isActive(request)) return
    unlockState.visible = false
    unlockState.loading = false
    unlockState.error = ''
    settle = null
    request.resolve()
}

export const cancelUnlock = () => {
    if (!settle) return
    const request = settle
    settle = null
    request.controller.abort()
    unlockState.visible = false
    unlockState.loading = false
    unlockState.error = ''
    request.reject(new Error('Разблокировка отменена'))
}

// Разблокирует хранилище (если нужно) и выполняет действие
export const ensureUnlocked = async (action, options) => {
    const status = await getCredentialSecurityStatus(false, false)
    if (!status.enabled || status.unlocked) return action()
    await showUnlock('hello', options)
    return action()
}

// Разблокировка Windows Hello (WebAuthn + PRF)
export const runHelloUnlock = async () => {
    if (unlockState.loading || !settle) return
    const request = settle
    unlockState.loading = true
    unlockState.error = ''
    try {
        const status = await getCredentialSecurityStatus(false, false)
        if (!isActive(request)) return
        const { key } = await unlockWithBiometricFlow({
            credentialId: status.credentialId,
            prfSalt: status.prfSalt,
            wrappedKey: status.wrappedKey,
            signal: request.controller.signal
        })
        if (!isActive(request)) return
        await unlockCredentialVaultWithHello(key, { refreshAfterUnlock: request.refreshAfterUnlock })
        finishUnlock(request)
    } catch (error) {
        if (isActive(request)) unlockState.error = error.message
    } finally {
        if (isActive(request)) unlockState.loading = false
    }
}

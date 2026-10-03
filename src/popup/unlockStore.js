// Глобальный механизм разблокировки хранилища по требованию.
// ensureUnlocked(action) — если хранилище заблокировано, показывает модалку
// (PIN или Windows Hello) и выполняет action после успешной разблокировки.
import { reactive } from 'vue'
import {
    getCredentialSecurityStatus,
    unlockCredentialVault,
    unlockCredentialVaultWithHello
} from './data/projectData'
import { unlockWithBiometricFlow } from '../utils/biometricHello'

export const unlockState = reactive({
    visible: false,
    mode: 'pin', // 'pin' | 'hello'
    loading: false,
    error: ''
})

let settle = null

const showUnlock = (mode) => new Promise((resolve, reject) => {
    settle = { resolve, reject }
    unlockState.mode = mode
    unlockState.loading = false
    unlockState.error = ''
    unlockState.visible = true
})

const finishUnlock = () => {
    unlockState.visible = false
    unlockState.loading = false
    unlockState.error = ''
    const done = settle?.resolve
    settle = null
    done?.()
}

export const cancelUnlock = () => {
    if (!settle) return
    const reject = settle.reject
    settle = null
    unlockState.visible = false
    unlockState.loading = false
    unlockState.error = ''
    reject(new Error('Разблокировка отменена'))
}

// Разблокирует хранилище (если нужно) и выполняет действие
export const ensureUnlocked = async (action) => {
    const status = await getCredentialSecurityStatus(false, false)
    if (!status.enabled || status.unlocked) return action()
    await showUnlock(status.mode === 'hello' ? 'hello' : 'pin')
    return action()
}

// Ввод PIN: пробуем разблокировать сразу, без кнопки подтверждения
export const submitPin = async (pin) => {
    if (unlockState.loading || !settle) return
    unlockState.loading = true
    unlockState.error = ''
    try {
        await unlockCredentialVault(pin)
        finishUnlock()
    } catch (error) {
        unlockState.error = error.message
    } finally {
        unlockState.loading = false
    }
}

// Разблокировка Windows Hello (WebAuthn + PRF)
export const runHelloUnlock = async () => {
    if (unlockState.loading || !settle) return
    unlockState.loading = true
    unlockState.error = ''
    try {
        const status = await getCredentialSecurityStatus(false, false)
        const { key } = await unlockWithBiometricFlow({
            credentialId: status.credentialId,
            prfSalt: status.prfSalt,
            wrappedKey: status.wrappedKey
        })
        await unlockCredentialVaultWithHello(key)
        finishUnlock()
    } catch (error) {
        unlockState.error = error.message
    } finally {
        unlockState.loading = false
    }
}

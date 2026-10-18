// @ts-check
import { extensionApi } from '../../platform/extensionApi.js'

const BACKGROUND_TIMEOUT = 35000

/**
 * @template {keyof import('../../types/messages.js').PopupResults} T
 * @param {T} type
 * @param {object} [payload]
 * @returns {Promise<import('../../types/messages.js').PopupResults[T]>}
 */
const callBackground = (type, payload = {}) => new Promise((resolve, reject) => {
    let settled = false
    const timeoutId = setTimeout(() => {
        if (settled) return
        settled = true
        reject(new Error('Фоновый процесс расширения не ответил. Перезагрузите расширение в настройках браузера.'))
    }, BACKGROUND_TIMEOUT)

    extensionApi.runtime.sendMessage({ type, payload }).then(/** @param {import('../../types/extension.js').RuntimeResponse<import('../../types/messages.js').PopupResults[T]>} response */ (response) => {
        if (settled) return
        settled = true
        clearTimeout(timeoutId)
        if (!response?.ok) {
            reject(new Error(response?.error || 'Неизвестная ошибка расширения'))
            return
        }
        resolve(response.data)
    }).catch(error => {
        if (settled) return
        settled = true
        clearTimeout(timeoutId)
        reject(new Error(`Фоновый процесс расширения недоступен: ${error.message}`))
    })
})

export const loadApiSettings = () => callBackground('data:settings:get')
export const loadActiveSupportTicket = () => callBackground('support:ticket:get')
export const resetActiveSupportTicket = () => callBackground('support:ticket:reset')

// Patch-сохранение: передаются только изменённые поля ({ projectsUrl } и/или { accessUrl })
/** @param {Partial<import('../../types/extension.js').ApiSettings>} patch */
export const saveApiSettings = (patch) =>
    callBackground('data:settings:set', patch)

export const loadProjectData = () => callBackground('data:projects:get')

export const authorizeAccessApi = () => callBackground('data:accesses:authorize')
export const authorizeProjectsApi = () => callBackground('data:projects:authorize')

/** @param {import('../../types/extension.js').RefreshOptions} [options] */
export const refreshAll = (options = {}) =>
    callBackground('data:all:refresh', options)

export const loadErrorLog = () => callBackground('data:errors:get')
export const clearErrorLog = () => callBackground('data:errors:clear')

export const clearAllData = () => callBackground('data:clear')
export const loadIconStatus = () => callBackground('icons:status')
export const refreshSiteIcons = () => callBackground('icons:refresh')
export const cancelSiteIcons = () => callBackground('icons:cancel')

/** @param {string} url @param {string} accessId */
export const startAdminAuth = (url, accessId) => callBackground('auth:start', { url, accessId })

export const loadServices = () => callBackground('services:get')

/** @param {string} id @param {import('../../types/extension.js').ServiceField} field */
export const getServiceField = (id, field) => callBackground('services:field', { id, field })

/** @param {string} url @param {string} accessId */
export const getProjectAccessText = (url, accessId) =>
    callBackground('project:copyAccess', { url, accessId })

/** @param {string} url */
export const loadProjectDetails = (url) =>
    callBackground('project:details', { url })

/** @param {string} url @param {string} accessId @param {import('../../types/extension.js').AccessField} field */
export const getProjectAccessField = (url, accessId, field) =>
    callBackground('project:accessField', { url, accessId, field })

export const getCredentialSecurityStatus = (helloAvailable = false, prfSupported = false) =>
    callBackground('security:status', { helloAvailable, prfSupported })

/** @param {Awaited<ReturnType<typeof import('../../utils/biometricHello.js').enableBiometricProtectionFlow>>} payload */
export const enableHelloProtection = (payload) => callBackground('security:enableHello', payload)

/** @param {string} key @param {{ refreshAfterUnlock?: boolean }} [options] */
export const unlockCredentialVaultWithHello = (key, { refreshAfterUnlock = true } = {}) => callBackground('security:unlockHelloKey', { key, refreshAfterUnlock })

export const lockCredentialVault = () => callBackground('security:lock')

export const disableCredentialProtection = () => callBackground('security:disable')

export const loadRefreshJob = () => callBackground("data:job:get")

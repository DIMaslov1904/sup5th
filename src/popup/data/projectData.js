const BACKGROUND_TIMEOUT = 35000

const callBackground = (type, payload = {}) => new Promise((resolve, reject) => {
    let settled = false
    const timeoutId = setTimeout(() => {
        if (settled) return
        settled = true
        reject(new Error('Фоновый процесс расширения не ответил. Перезагрузите расширение на странице chrome://extensions.'))
    }, BACKGROUND_TIMEOUT)

    chrome.runtime.sendMessage({ type, payload }, (response) => {
        if (settled) return
        settled = true
        clearTimeout(timeoutId)
        const error = chrome.runtime.lastError
        if (error) {
            reject(new Error(`Фоновый процесс расширения недоступен: ${error.message}`))
            return
        }
        if (!response?.ok) {
            reject(new Error(response?.error || 'Неизвестная ошибка расширения'))
            return
        }
        resolve(response.data)
    })
})

export const loadApiSettings = () => callBackground('data:settings:get')

// Patch-сохранение: передаются только изменённые поля ({ projectsUrl } и/или { accessUrl })
export const saveApiSettings = (patch) =>
    callBackground('data:settings:set', patch)

export const loadProjectData = () => callBackground('data:projects:get')

export const authorizeAccessApi = () => callBackground('data:accesses:authorize')
export const authorizeProjectsApi = () => callBackground('data:projects:authorize')

export const refreshAll = (options = {}) =>
    callBackground('data:all:refresh', options)

export const loadErrorLog = () => callBackground('data:errors:get')
export const clearErrorLog = () => callBackground('data:errors:clear')

export const clearAllData = () => callBackground('data:clear')
export const loadIconStatus = () => callBackground('icons:status')
export const refreshSiteIcons = () => callBackground('icons:refresh')
export const cancelSiteIcons = () => callBackground('icons:cancel')

export const startAdminAuth = (url, accessId) => callBackground('auth:start', { url, accessId })

export const loadServices = () => callBackground('services:get')

export const getServiceField = (id, field) => callBackground('services:field', { id, field })

export const getProjectAccessText = (url, accessId) =>
    callBackground('project:copyAccess', { url, accessId })

export const loadProjectDetails = (url) =>
    callBackground('project:details', { url })

export const getProjectAccessField = (url, accessId, field) =>
    callBackground('project:accessField', { url, accessId, field })

export const getCredentialSecurityStatus = (helloAvailable = false, prfSupported = false) =>
    callBackground('security:status', { helloAvailable, prfSupported })

export const enableHelloProtection = (payload) => callBackground('security:enableHello', payload)

export const unlockCredentialVaultWithHello = (key, { refreshAfterUnlock = true } = {}) => callBackground('security:unlockHelloKey', { key, refreshAfterUnlock })

export const lockCredentialVault = () => callBackground('security:lock')

export const disableCredentialProtection = () => callBackground('security:disable')

export const loadRefreshJob = () => callBackground("data:job:get")

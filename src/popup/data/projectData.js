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

export const refreshProjects = (url) =>
    callBackground('data:projects:refresh', { url })

export const refreshAccesses = (url) =>
    callBackground('data:accesses:refresh', { url })

export const refreshAll = (settings) =>
    callBackground('data:all:refresh', settings)

export const loadErrorLog = () => callBackground('data:errors:get')

export const clearAllData = () => callBackground('data:clear')

export const startAdminAuth = (url, index = 0) => callBackground('auth:start', { url, index })

export const loadServices = () => callBackground('services:get')

export const saveServices = (services) => callBackground('services:save', { services })

export const getProjectAccessText = (url, index) =>
    callBackground('project:copyAccess', { url, index })

export const loadProjectDetails = (url) =>
    callBackground('project:details', { url })

export const getProjectAccessField = (url, index, field) =>
    callBackground('project:accessField', { url, index, field })

export const getCredentialSecurityStatus = (helloAvailable = false, prfSupported = false) =>
    callBackground('security:status', { helloAvailable, prfSupported })

export const enablePinProtection = (pin) => callBackground('security:enablePin', { pin })

export const enableHelloProtection = (payload) => callBackground('security:enableHello', payload)

export const unlockCredentialVault = (pin) => callBackground('security:unlockPin', { pin })

export const unlockCredentialVaultWithHello = (key) => callBackground('security:unlockHelloKey', { key })

export const lockCredentialVault = () => callBackground('security:lock')

export const disableCredentialProtection = () => callBackground('security:disable')

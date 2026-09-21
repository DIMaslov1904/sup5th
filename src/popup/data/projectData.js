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

export const saveApiSettings = (settings) =>
    callBackground('data:settings:set', { settings })

export const loadProjectData = () => callBackground('data:projects:get')

export const refreshProjects = (url) =>
    callBackground('data:projects:refresh', { url })

export const refreshAccesses = (url) =>
    callBackground('data:accesses:refresh', { url })

export const refreshAll = (settings) =>
    callBackground('data:all:refresh', settings)

export const loadErrorLog = () => callBackground('data:errors:get')

export const clearAllData = () => callBackground('data:clear')

export const startAdminAuth = (url) => callBackground('auth:start', { url })

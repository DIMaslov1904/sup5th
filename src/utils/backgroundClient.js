import { extensionApi } from '../platform/extensionApi.js'

const DEFAULT_TIMEOUT = 35000
const DEFAULT_UNAVAILABLE = 'Фоновый процесс расширения недоступен'
const DEFAULT_TIMEOUT_ERROR = 'Фоновый процесс расширения не ответил. Перезагрузите расширение в настройках браузера.'

/**
 * Sends a message to the background service worker and unwraps its response.
 * One timeout and one error contract for every extension page.
 * @template {keyof import('../types/messages.js').PopupResults} T
 * @param {T} type
 * @param {object} [payload]
 * @param {{ timeout?: number, fallbackError?: string, unavailableError?: string }} [options]
 * @returns {Promise<import('../types/messages.js').PopupResults[T]>}
 */
export const callBackground = (type, payload = {}, options = {}) => new Promise((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => {
        if (settled) return
        settled = true
        reject(new Error(DEFAULT_TIMEOUT_ERROR))
    }, Number(options.timeout) || DEFAULT_TIMEOUT)

    const settle = (action, value) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        action(value)
    }
    const unavailable = message => new Error(`${options.unavailableError || DEFAULT_UNAVAILABLE}: ${message}`)

    extensionApi.runtime.sendMessage({ type, payload }).then(response => {
        if (!response?.ok) settle(reject, new Error(response?.error || options.fallbackError || 'Неизвестная ошибка расширения'))
        else settle(resolve, response.data)
    }).catch(error => settle(reject, unavailable(error.message)))
})

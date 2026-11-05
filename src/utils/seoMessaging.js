// Some Chromium builds never settle tabs.sendMessage when the target frame has no
// listener, so both the probe and the injected-script call are bounded by a timer.
const withTimeout = (promise, ms) => new Promise(resolve => {
    let settled = false
    const finish = value => { if (settled) return; settled = true; clearTimeout(timer); resolve(value) }
    const timer = setTimeout(() => finish(null), ms)
    promise.then(value => finish(value), () => finish(null))
})

const PROBE_TIMEOUT = 2000
const INJECT_TIMEOUT = 10000
const INJECTED_TIMEOUT = 15000

export class SeoTabUnavailableError extends Error {}

export const createSeoMessenger = ({ sendMessage, inject }) => async (tabId, type, payload = {}) => {
    if (!Number.isInteger(tabId)) throw new SeoTabUnavailableError('Откройте страницу сайта и запустите анализ.')
    const request = () => sendMessage(tabId, { type, payload }, { frameId: 0 })
    let response = await withTimeout(request(), PROBE_TIMEOUT)
    if (response == null) {
        const injected = await withTimeout(Promise.resolve().then(() => inject(tabId)), INJECT_TIMEOUT)
        if (injected == null) throw new SeoTabUnavailableError('Откройте проверяемую вкладку и повторите анализ.')
        response = await withTimeout(request(), INJECTED_TIMEOUT)
    }
    if (response == null) throw new SeoTabUnavailableError('Обновите проверяемую страницу и повторите анализ.')
    if (!response.ok) throw new Error(response.error || 'Не удалось получить SEO-данные')
    return response.data
}

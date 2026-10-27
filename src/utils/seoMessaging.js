export const createSeoMessenger = ({ sendMessage, inject }) => async (tabId, type = 'seo:scan', payload = {}) => {
    if (!Number.isInteger(tabId)) throw new Error('Откройте проверяемый сайт')
    const request = () => sendMessage(tabId, { type, payload }, { frameId: 0 })
    let response
    try { response = await request() }
    catch { /* A missing receiver may reject or resolve without a response. */ }
    if (response == null) {
        try { await inject(tabId); response = await request() }
        catch (error) { throw new Error(`Не удалось запустить SEO-анализ: ${error.message}`, { cause: error }) }
    }
    if (response == null) throw new Error('SEO-скрипт не ответил после запуска. Перезагрузите проверяемую страницу и повторите анализ.')
    if (!response.ok) throw new Error(response.error || 'Не удалось получить SEO-данные')
    return response.data
}

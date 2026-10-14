export const callBackground = (type, payload = {}) => chrome.runtime.sendMessage({ type, payload }).then(response => {
    if (!response?.ok) throw new Error(response?.error || 'Нет ответа от расширения')
    return response.data
})
export const fetchSeo = (url, method = 'GET', maxBytes) => callBackground('seo:fetch', { url, method, maxBytes })
export const sendSeoToTab = async (tabId, type = 'seo:scan', payload = {}) => {
    if (!Number.isInteger(tabId)) throw new Error('Откройте проверяемый сайт')
    let response
    try { response = await chrome.tabs.sendMessage(tabId, { type, payload }, { frameId: 0 }) }
    catch {
        try {
            await chrome.scripting.executeScript({ target: { tabId }, files: [seoScript] })
            response = await chrome.tabs.sendMessage(tabId, { type, payload }, { frameId: 0 })
        } catch { throw new Error('Нет доступа к странице. Откройте расширение из проверяемой вкладки или предоставьте доступ к сайту.') }
    }
    if (!response?.ok) throw new Error(response?.error || 'Не удалось получить SEO-данные')
    return response.data
}
export const openSeoApp = (tabId, tool = 'seo') => chrome.tabs.create({
    url: `${chrome.runtime.getURL('src/options/index.html')}?tool=${encodeURIComponent(tool)}&tabId=${tabId}`
})
export const downloadText = (text, filename, type = 'text/plain') => {
    const url = URL.createObjectURL(new Blob([text], { type }))
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}
import seoScript from '../content-script/seo.js?script&iife'

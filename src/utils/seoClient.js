import { extensionApi, isFirefox } from '../platform/extensionApi.js'
import { createSeoSidePanel } from './seoSidePanel.js'
import { injectExtensionScript } from '../platform/scriptInjection.js'
import { seoAppUrl } from './seoSections.js'
const sidePanel = createSeoSidePanel(extensionApi, { firefox: isFirefox })
export const canPinSeoPage = sidePanel.supported
export const pinSeoPage = sidePanel.open
export const callBackground = (type, payload = {}) => extensionApi.runtime.sendMessage({ type, payload }).then(response => {
    if (!response?.ok) throw new Error(response?.error || 'Нет ответа от расширения')
    return response.data
})
export const fetchSeo = (url, method = 'GET', maxBytes, options = {}) => callBackground('seo:fetch', { url, method, maxBytes, ...options })
export const sendSeoToTab = async (tabId, type = 'seo:scan', payload = {}) => {
    if (!Number.isInteger(tabId)) throw new Error('Откройте проверяемый сайт')
    let response
    try { response = await extensionApi.tabs.sendMessage(tabId, { type, payload }, { frameId: 0 }) }
    catch {
        try {
            await injectExtensionScript(tabId, seoScript)
            response = await extensionApi.tabs.sendMessage(tabId, { type, payload }, { frameId: 0 })
        } catch (error) { throw new Error(`Не удалось запустить SEO-анализ: ${error.message}`, { cause: error }) }
    }
    if (!response?.ok) throw new Error(response?.error || 'Не удалось получить SEO-данные')
    return response.data
}
export const openSeoApp = (tabId, tool = 'seo', section = '') => extensionApi.tabs.create({
    url: seoAppUrl(extensionApi.runtime.getURL('src/options/index.html'), tabId, tool, section)
})
export const downloadText = (text, filename, type = 'text/plain') => {
    const url = URL.createObjectURL(new Blob([text], { type }))
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}
import seoScript from '../content-script/seo.js?script&iife'

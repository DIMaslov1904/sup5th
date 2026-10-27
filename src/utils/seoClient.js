import { extensionApi, isFirefox, isSafari } from '../platform/extensionApi.js'
import { createSeoSidePanel } from './seoSidePanel.js'
import { injectExtensionScript } from '../platform/scriptInjection.js'
import { seoAppUrl } from './seoSections.js'
import { createSeoMessenger } from './seoMessaging.js'
const sidePanel = createSeoSidePanel(extensionApi, { firefox: isFirefox, safari: isSafari })
export const canPinSeoPage = sidePanel.supported
export const pinSeoPage = sidePanel.open
export const callBackground = (type, payload = {}) => extensionApi.runtime.sendMessage({ type, payload }).then(response => {
    if (!response?.ok) throw new Error(response?.error || 'Нет ответа от расширения')
    return response.data
})
export const fetchSeo = (url, method = 'GET', maxBytes, options = {}) => callBackground('seo:fetch', { url, method, maxBytes, ...options })
export const sendSeoToTab = createSeoMessenger({
    sendMessage: (...args) => extensionApi.tabs.sendMessage(...args),
    inject: tabId => injectExtensionScript(tabId, seoScript)
})
export const openSeoApp = (tabId, tool = 'seo', section = '') => extensionApi.tabs.create({
    url: seoAppUrl(extensionApi.runtime.getURL('src/options/index.html'), tabId, tool, section)
})
export const downloadText = (text, filename, type = 'text/plain') => {
    const url = URL.createObjectURL(new Blob([text], { type }))
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}
import seoScript from '../content-script/seo.js?script&iife'

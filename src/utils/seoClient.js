import { extensionApi, isFirefox } from '../platform/extensionApi.js'
import seoScript from '../content-script/seo.js?script&iife'
import { createSeoSidePanel } from './seoSidePanel.js'
import { injectExtensionScript } from '../platform/scriptInjection.js'
import { seoAppUrl } from './seoSections.js'
import { createSeoMessenger } from './seoMessaging.js'
import { callBackground } from './backgroundClient.js'
const sidePanel = createSeoSidePanel(extensionApi, { firefox: isFirefox })
export const canPinSeoPage = sidePanel.supported
export const pinSeoPage = sidePanel.open
export const fetchSeo = (url, method = 'GET', maxBytes, options = {}) => callBackground('seo:fetch', { url, method, maxBytes, ...options })
export const sendSeoToTab = createSeoMessenger({
    sendMessage: (...args) => extensionApi.tabs.sendMessage(...args),
    inject: tabId => injectExtensionScript(tabId, seoScript)
})

// A frozen (background) tab never answers tabs.sendMessage or scripting.executeScript,
// so wake it by activating the tab for the duration of the first scan.
export const withActiveTab = async (tabId, action) => {
    let previous = null
    let needsWake = false
    try {
        ;[previous] = await extensionApi.tabs.query({ active: true, currentWindow: true })
        const tab = await extensionApi.tabs.get(tabId)
        needsWake = tab?.frozen === true || tab?.discarded === true
        if (needsWake) {
            await extensionApi.tabs.update(tabId, { active: true })
            await new Promise(resolve => setTimeout(resolve, 300))
        }
    } catch { /* the message timeout below reports the real failure */ }
    try { return await action() }
    finally {
        if (needsWake && previous?.id && previous.id !== tabId) {
            try { await extensionApi.tabs.update(previous.id, { active: true }) } catch { /* nothing to restore */ }
        }
    }
}
export const openSeoApp = (tabId, tool = 'seo', section = '') => extensionApi.tabs.create({
    url: seoAppUrl(extensionApi.runtime.getURL('src/options/index.html'), tabId, tool, section)
})
export const openSocialPreview = tabId => extensionApi.tabs.create({
    url: extensionApi.runtime.getURL('src/social-preview/index.html') + '?tabId=' + tabId
})
export const downloadText = (text, filename, type = 'text/plain') => {
    const url = URL.createObjectURL(new Blob([text], { type }))
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}

import { fetchSeoResource } from './seoFetch.js'
import { getServerAddress } from './serverAddress.js'
import { downloadSeoImage } from './imageDownload.js'
import { syncSiteIcons, getSiteIconStatus, cancelSiteIcons, clearSiteIcons } from '../icons/iconService.js'
import { registerPopupSession } from './popupSession.js'
import { storageReady, SCHEMA_VERSION, SERVICES_KEY, ERRORS_KEY, storageGet, storageSet, sessionSet, getStoredData, mutateStorage, invalidateOperations } from './storageRepository.js'
import { getSecurityStatus, enableHelloProtection, unlockWithHelloKey, lockCredentialVault, disableCredentialProtection, registerVaultIdleLock } from './credentialVault.js'
import { readApiSettings, saveApiSettings } from './apiSettings.js'
import { refreshAll, getRefreshJob, cancelRefresh, scheduleRefresh, PROJECTS_ALARM, REFRESH_JOB_KEY } from './apiRefresh.js'
import { toPublicData } from './catalogueData.js'
import { updateActiveTabIcon, updateBadgeForTab } from './actionBadge.js'
import { getActiveSupportTicket, observeSupportTicket, resetActiveSupportTicket, registerSupportTicketTracking } from './supportTicketTracking.js'
import { startAdminAuth, authContext, consumePendingAdminAuth, injectAuthForTab, forgetAuthTab, copyProjectAccessText, getProjectDetails, getProjectAccessField, getServices, getServiceField } from './projectAccess.js'

registerPopupSession()
registerVaultIdleLock()
const ready = storageReady.then(async reset => {
    if (reset) await clearSiteIcons()
    const job = await getRefreshJob()
    if (job.running) await sessionSet(REFRESH_JOB_KEY, { ...job, running: false, state: 'interrupted', finishedAt: Date.now(), errors: ['Фоновый процесс был перезапущен. Повторите загрузку.'] })
})
registerSupportTicketTracking(ready)
const syncCatalogueIcons = async options => {
    const [data, services] = await Promise.all([getStoredData(), storageGet(SERVICES_KEY, [])])
    return syncSiteIcons([...toPublicData(data).lastSuccessfulData.projects, ...services], options)
}
const loadData = async options => {
    const data = await refreshAll(options)
    syncCatalogueIcons().catch(error => console.error('[icons] catalogue', error))
    updateActiveTabIcon()
    return toPublicData(data)
}
const clearAllData = async () => {
    invalidateOperations(); cancelRefresh()
    await lockCredentialVault()
    await clearSiteIcons()
    await mutateStorage(async () => {
        await chrome.storage.local.clear(); await chrome.storage.session.clear()
        await chrome.storage.local.set({ schemaVersion: SCHEMA_VERSION })
        await chrome.alarms.clear(PROJECTS_ALARM)
        invalidateOperations()
    })
    return { cleared: true }
}
const authorize = async type => {
    const settings = await readApiSettings(), url = settings[type === 'projects' ? 'projectsUrl' : 'accessUrl']
    if (!url) throw new Error('Сначала сохраните адрес API')
    await chrome.tabs.create({ url }); return { opened: true }
}
const handlers = {
    'support:ticket:get': getActiveSupportTicket, 'support:ticket:reset': resetActiveSupportTicket,
    'support:ticket:observe': observeSupportTicket,
    'seo:fetch': fetchSeoResource, 'seo:downloadImage': downloadSeoImage, 'seo:serverIp': getServerAddress,
    'icons:status': getSiteIconStatus, 'icons:refresh': () => syncCatalogueIcons({ force: true }), 'icons:cancel': cancelSiteIcons,
    'services:get': getServices, 'services:field': getServiceField,
    'data:settings:get': readApiSettings,
    'data:settings:set': async payload => { const settings = await saveApiSettings(payload); await scheduleRefresh(); return settings },
    'data:projects:get': () => getStoredData().then(toPublicData), 'data:all:refresh': loadData, 'data:job:get': getRefreshJob,
    'data:projects:authorize': () => authorize('projects'), 'data:accesses:authorize': () => authorize('accesses'),
    'data:errors:get': () => storageGet(ERRORS_KEY, []), 'data:errors:clear': () => mutateStorage(() => storageSet(ERRORS_KEY, [])),
    'data:clear': clearAllData, 'auth:start': startAdminAuth, 'auth:context': authContext, 'auth:consume': consumePendingAdminAuth,
    'project:details': getProjectDetails, 'project:accessField': getProjectAccessField, 'project:copyAccess': copyProjectAccessText,
    'security:status': getSecurityStatus, 'security:enableHello': enableHelloProtection,
    'security:unlockHelloKey': async payload => {
        const status = await unlockWithHelloKey(payload)
        if (payload.refreshAfterUnlock !== false) loadData({ onlyIfDue: true }).catch(() => {})
        return status
    },
    'security:lock': lockCredentialVault, 'security:disable': disableCredentialProtection
}
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const handler = Object.hasOwn(handlers, message?.type) ? handlers[message.type] : null
    if (!handler) return false
    const internal = sender.id === chrome.runtime.id && sender.url?.startsWith(chrome.runtime.getURL(''))
    const contentAllowed = ['auth:context', 'auth:consume', 'seo:fetch', 'seo:downloadImage'].includes(message.type)
    const supportAllowed = message.type === 'support:ticket:observe' && /^https:\/\/support\.5th\.ru\//.test(sender.url || '')
    if (!internal && ((!contentAllowed && !supportAllowed) || sender.id !== chrome.runtime.id || sender.frameId !== 0 || !/^https?:\/\//.test(sender.url || ''))) {
        sendResponse({ ok: false, error: 'Операция доступна только в интерфейсе расширения' }); return false
    }
    ready.then(() => handler(message.payload || {}, sender)).then(data => sendResponse({ ok: true, data }))
        .catch(error => { console.error(`[background] ${message.type}`, error); sendResponse({ ok: false, error: error.message }) })
    return true
})
const startup = () => ready.then(async () => {
    await scheduleRefresh()
    const settings = await readApiSettings()
    if (settings.projectsUrl || settings.accessUrl) await loadData({ onlyIfDue: true })
}).catch(error => console.error('[background] startup', error))
chrome.runtime.onInstalled.addListener(startup)
chrome.runtime.onStartup.addListener(startup)
chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === PROJECTS_ALARM) startup() })
chrome.tabs.onActivated.addListener(({ tabId }) => updateBadgeForTab(tabId))
chrome.tabs.onRemoved.addListener(tabId => ready.then(() => forgetAuthTab(tabId)).catch(console.error))
chrome.tabs.onUpdated.addListener((tabId, changes, tab) => {
    if (changes.status !== 'complete') return
    updateBadgeForTab(tabId)
    ready.then(() => injectAuthForTab(tabId, tab.url)).catch(error => console.error('[auth] inject', error))
})

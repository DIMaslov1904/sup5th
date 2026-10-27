import { extensionApi } from '../platform/extensionApi.js'
import { trustedLocal } from '../platform/trustedStorage.js'
import { createBiometricPageHandlers } from './biometricPages.js'
import { fetchSeoResource } from './seoFetch.js'
import { getProjectShortcuts, updateProjectShortcuts } from './projectShortcuts.js'
import { getPipelineAbsence, setPipelineAbsence } from './pipelineBadges.js'
import { downloadSeoImage } from './imageDownload.js'
import { syncSiteIcons, getSiteIconStatus, cancelSiteIcons, clearSiteIcons } from '../icons/iconService.js'
import { registerPopupSession } from './popupSession.js'
import { storageReady, SCHEMA_VERSION, SERVICES_KEY, ERRORS_KEY, storageGet, storageSet, getStoredData, mutateStorage, invalidateOperations } from './storageRepository.js'
import { getSecurityStatus, enableHelloProtection, unlockWithHelloKey, lockCredentialVault, disableCredentialProtection, registerVaultIdleLock } from './credentialVault.js'
import { readApiSettings, saveApiSettings } from './apiSettings.js'
import { refreshAll, getRefreshJob, saveRefreshJob, cancelRefresh, scheduleRefresh, PROJECTS_ALARM } from './apiRefresh.js'
import { toPublicData } from './catalogueData.js'
import { updateActiveTabIcon, updateBadgeForTab } from './actionBadge.js'
import { getActiveSupportTicket, observeSupportTicket, resetActiveSupportTicket, registerSupportTicketTracking } from './supportTicketTracking.js'
import { startAdminAuth, authContext, consumePendingAdminAuth, injectAuthForTab, forgetAuthTab, copyProjectAccessText, getProjectDetails, getProjectAccessField, getServices, getServiceField } from './projectAccess.js'
import { updateChecker, registerExtensionUpdates } from './extensionUpdates.js'
import { openSupportTicket, supportAuthPage, forgetSupportAuthTab } from './supportAuth.js'

registerPopupSession()
registerVaultIdleLock()
const ready = storageReady.then(async reset => {
    if (reset) await clearSiteIcons()
    const job = await getRefreshJob()
    if (job.running) await saveRefreshJob({ ...job, running: false, state: 'interrupted', finishedAt: Date.now(), errors: ['Фоновый процесс был перезапущен. Повторите загрузку.'] })
})
registerSupportTicketTracking(ready)
registerExtensionUpdates(ready)
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
    await updateChecker.cancel()
    invalidateOperations(); cancelRefresh()
    await lockCredentialVault()
    await clearSiteIcons()
    await mutateStorage(async () => {
        await trustedLocal.clear(); await extensionApi.storage.session.clear()
        await trustedLocal.set({ schemaVersion: SCHEMA_VERSION })
        await extensionApi.alarms.clear(PROJECTS_ALARM)
        invalidateOperations()
    })
    return { cleared: true }
}
const authorize = async type => {
    const settings = await readApiSettings(), url = settings[type === 'projects' ? 'projectsUrl' : 'accessUrl']
    if (!url) throw new Error('Сначала сохраните адрес API')
    await extensionApi.tabs.create({ url }); return { opened: true }
}
const handlers = {
    'pipeline:absence:get': getPipelineAbsence, 'pipeline:absence:set': setPipelineAbsence,
    'shortcuts:get': getProjectShortcuts, 'shortcuts:update': updateProjectShortcuts,
    'updates:status': () => updateChecker.getStatus(), 'updates:check': () => updateChecker.check({ force: true }),
    'support:ticket:get': getActiveSupportTicket, 'support:ticket:reset': resetActiveSupportTicket,
    'support:ticket:observe': observeSupportTicket,
    'support:ticket:open': openSupportTicket, 'support:auth:page': supportAuthPage,
    'seo:fetch': fetchSeoResource, 'seo:downloadImage': downloadSeoImage,
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
Object.assign(handlers, createBiometricPageHandlers({ unlock: handlers['security:unlockHelloKey'], refreshData: loadData }))
extensionApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const handler = Object.hasOwn(handlers, message?.type) ? handlers[message.type] : null
    if (!handler) return false
    const internal = sender.id === extensionApi.runtime.id && sender.url?.startsWith(extensionApi.runtime.getURL(''))
    const contentAllowed = ['auth:context', 'auth:consume', 'seo:fetch', 'seo:downloadImage'].includes(message.type)
    const supportAllowed = ['support:ticket:observe', 'support:auth:page'].includes(message.type) && /^https:\/\/support\.5th\.ru\//.test(sender.url || '')
    if (!internal && ((!contentAllowed && !supportAllowed) || sender.id !== extensionApi.runtime.id || sender.frameId !== 0 || !/^https?:\/\//.test(sender.url || ''))) {
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
extensionApi.runtime.onInstalled.addListener(startup)
extensionApi.runtime.onStartup.addListener(startup)
extensionApi.alarms.onAlarm.addListener(alarm => { if (alarm.name === PROJECTS_ALARM) startup() })
extensionApi.tabs.onActivated.addListener(({ tabId }) => updateBadgeForTab(tabId))
extensionApi.tabs.onRemoved.addListener(tabId => ready.then(() => Promise.all([forgetAuthTab(tabId), forgetSupportAuthTab(tabId)])).catch(console.error))
extensionApi.tabs.onUpdated.addListener((tabId, changes, tab) => {
    if (changes.status !== 'complete') return
    updateBadgeForTab(tabId)
    ready.then(() => injectAuthForTab(tabId, tab.url)).catch(error => console.error('[auth] inject', error))
})

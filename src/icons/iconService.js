import { iconRepository } from './iconRepository.js'
import { catalogueOrigins, ICON_CACHE_WARNING } from './iconPolicy.js'
import { createIconQueue } from './iconQueue.js'
import { createIconFetcher } from './iconFetcher.js'
import { closeIconDecoder } from './iconDecoder.js'
import { hasOrigin } from '../utils/hostPermissions.js'

const alarm = 'site-icons-resume'
const broadcast = data => chrome.runtime.sendMessage({ type: 'icons:changed', ...data }).catch(() => {})
const schedule = async active => {
    if (!active) { await chrome.alarms.clear(alarm); return }
    if (!await chrome.alarms.get(alarm)) await chrome.alarms.create(alarm, { periodInMinutes: 0.5 })
}
const queue = createIconQueue({ repository: iconRepository, fetchIcon: createIconFetcher(iconRepository), schedule, notify: broadcast })
let work
export const resumeSiteIcons = () => {
    if (work) return work
    let failed = false
    work = (async () => {
        await schedule((await queue.status()).active)
        await queue.drain()
    })().catch(error => { failed = true; console.error('[icons]', error) }).finally(async () => {
        work = null
        const status = await queue.status().catch(() => null)
        if (status?.active && !failed) resumeSiteIcons()
        else await closeIconDecoder().catch(() => {})
    })
    return work
}

export const syncSiteIcons = async (items, options) => {
    const origins = catalogueOrigins(items)
    const allowed = (await Promise.all(origins.map(async origin => await hasOrigin(origin) ? origin : null))).filter(Boolean)
    const result = await queue.reconcile(allowed, options)
    resumeSiteIcons()
    return result
}
export const getSiteIconStatus = async () => {
    const records = await iconRepository.list()
    const bytes = records.reduce((sum, record) => sum + (record.image?.size || 0), 0)
    const largeWarning = bytes >= ICON_CACHE_WARNING && !await iconRepository.warningSeen()
    if (largeWarning) await iconRepository.markWarningSeen()
    return { ...(await queue.status()), cached: records.filter(record => record.image).length, bytes, largeWarning }
}
export const cancelSiteIcons = () => queue.cancel()
export const clearSiteIcons = async () => {
    await queue.cancel()
    await iconRepository.clear()
    await broadcast({ cleared: true })
}
chrome.alarms.onAlarm.addListener(event => { if (event.name === alarm) resumeSiteIcons() })
chrome.runtime.onStartup.addListener(resumeSiteIcons)
chrome.runtime.onInstalled.addListener(resumeSiteIcons)

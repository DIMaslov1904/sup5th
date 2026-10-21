import { evaluateRobotsFile, indexingRulesFromMeta } from './seoRules.js'
import { withoutFragment } from './linkCheckStatus.js'

export const loadSeoNetwork = async (initial, fetchResource, onUpdate = () => {}) => {
    let report = initial, sitemapRevision = 0
    const publish = patch => { report = { ...report, ...patch }; onUpdate(report) }
    const request = async (url, method = 'GET', options = {}) => {
        try { return await fetchResource(url, method, options) }
        catch { return { ok: false, status: 0, url, headers: {}, text: '', ttfb: null } }
    }
    const head = async (url, trace = false) => {
        let info = await request(url, 'HEAD', { trace })
        if ([0, 405, 501].includes(info.status)) info = await request(url, 'GET', { trace })
        return info
    }
    const sitemap = async url => {
        const revision = ++sitemapRevision
        publish({ sitemap: { url, pending: true, status: 0, exists: false } })
        const info = await head(url)
        if (revision === sitemapRevision) publish({ sitemap: { url, exists: info.ok, status: info.status, pending: false } })
    }
    const defaultSitemap = new URL('/sitemap.xml', initial.url).href
    const pageWork = (async () => {
        const info = await head(initial.url, true)
        const xRobots = info.headers?.['x-robots-tag'] || ''
        const indexing = indexingRulesFromMeta(initial.indexingMeta || initial.metaTags || [], info.xRobotsTags || xRobots)
        publish({ ...indexing, xRobots, xRobotsAllowed: info.status ? indexing.xRobotsAllowed : null,
            finalUrl: info.url || initial.url, redirected: Boolean(info.url && withoutFragment(info.url) !== withoutFragment(initial.url)),
            response: { status: info.status, ok: info.ok, ttfb: info.ttfb ?? null, headers: info.headers || {}, ip: info.ip || '', chain: info.chain || [], traceComplete: info.traceComplete === true, pending: false } })
    })()
    const robotsWork = (async () => {
        const url = new URL('/robots.txt', initial.url).href, info = await request(url)
        const file = { url, exists: info.ok, status: info.status, content: info.text || '', truncated: info.truncated === true, failure: info.failure, pending: false }
        publish({ robotsFile: { ...file, allowed: evaluateRobotsFile(file, initial.url).allowed } })
        const declared = file.content.match(/^\s*Sitemap:\s*(\S+)/im)?.[1]
        if (!declared) return
        try {
            const target = new URL(declared, initial.url)
            if (/^https?:$/.test(target.protocol) && target.href !== defaultSitemap) await sitemap(target.href)
        } catch { /* Ignore a malformed Sitemap declaration; robots rules remain available. */ }
    })()
    await Promise.all([pageWork, robotsWork, sitemap(defaultSitemap)])
    return report
}

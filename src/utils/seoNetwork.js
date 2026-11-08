import { evaluateRobotsFile, indexingRulesFromMeta } from './seoRules.js'
import { withoutFragment } from './linkCheckStatus.js'

// Retry unsupported HEAD and network failures; a timeout or denied permission also affects GET.
export const requestWithHeadFallback = async (request, url, options = {}) => {
    const head = await request(url, 'HEAD', options)
    return [0, 405, 501].includes(head.status) && !['timeout', 'permission'].includes(head.failure) ? request(url, 'GET', options) : head
}

export const seoResponsePatch = (initial, info, requestedUrl = initial.url) => {
    const xRobots = info.headers?.['x-robots-tag'] || ''
    const indexing = indexingRulesFromMeta(initial.indexingMeta || initial.metaTags || [], info.xRobotsTags || xRobots)
    const metaCharset = initial.charset?.document || initial.charset?.meta || ''
    const httpCharset = String(info.headers?.['content-type'] || '').match(/charset\s*=\s*["']?([\w-]+)/i)?.[1] || ''
    return {
        ...indexing, xRobots, xRobotsAllowed: info.status ? indexing.xRobotsAllowed : null,
        finalUrl: info.url || initial.url, redirected: Boolean(info.url && withoutFragment(info.url) !== withoutFragment(requestedUrl)),
        charset: {
            meta: metaCharset, http: httpCharset,
            consistent: metaCharset && httpCharset ? metaCharset.toLowerCase() === httpCharset.toLowerCase() : null
        },
        response: { status: info.status, ok: info.ok, ttfb: info.ttfb ?? null, headers: info.headers || {}, ip: info.ip || '', chain: info.chain || [], traceComplete: info.traceComplete === true, pending: false }
    }
}

export const loadSeoNetwork = async (initial, fetchResource, publish) => {
    let sitemapRevision = 0
    const request = async (url, method = 'GET', options = {}) => {
        try { return await fetchResource(url, method, options) }
        catch { return { ok: false, status: 0, url, headers: {}, text: '', ttfb: null } }
    }
    const head = (url, trace = false) => requestWithHeadFallback(request, url, { trace })
    const sitemap = async url => {
        const revision = ++sitemapRevision
        publish({ sitemap: { url, pending: true, status: 0, exists: false } })
        const info = await head(url)
        if (revision === sitemapRevision) publish({ sitemap: { url, exists: info.ok, status: info.status, pending: false } })
    }
    const defaultSitemap = new URL('/sitemap.xml', initial.url).href
    const pageWork = (async () => {
        if (initial.source === 'html') return
        const info = await head(initial.url, true)
        publish(seoResponsePatch(initial, info))
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
    const llmWork = (async () => {
        const url = new URL('/llm.txt', initial.url).href, info = await request(url)
        publish({ llmTxt: { url, exists: info.ok, status: info.status, size: info.text ? info.text.length : null, pending: false } })
    })()
    await Promise.all([pageWork, robotsWork, sitemap(defaultSitemap), llmWork])
}

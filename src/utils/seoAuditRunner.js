import { collectSitemap, sitemapRoots, parseSitemapXml } from './sitemap.js'
import { evaluateRobotsFile, parseMetaHtml } from './seoRules.js'
import { inspectAuditPage, normalizeAuditPageLimit, AUDIT_HTML_LIMIT, DEFAULT_AUDIT_PAGE_LIMIT } from './seoAuditPages.js'
import { createAuditDiscovery } from './seoAuditDiscovery.js'
import { withoutFragment } from './linkCheckStatus.js'
const empty = url => ({ ok: false, status: 0, url, headers: {}, text: '', ttfb: null })
const emptySitemap = () => ({ state: 'unknown', files: [], pages: [], errors: [], duplicates: 0, duplicateUrls: [], pending: true, complete: false, containsCurrent: false })

export const createAuditControl = signal => {
    let paused = false
    const waiters = new Set()
    return {
        pause: () => { paused = true },
        resume: () => { paused = false; for (const release of [...waiters]) release() },
        waitForResume: async () => {
            signal?.throwIfAborted()
            while (paused) {
                signal?.throwIfAborted()
                await new Promise((resolve, reject) => {
                    const cleanup = () => { waiters.delete(release); signal?.removeEventListener('abort', abort) }
                    const release = () => { cleanup(); resolve() }
                    const abort = () => { cleanup(); reject(signal.reason) }
                    waiters.add(release); signal?.addEventListener('abort', abort, { once: true })
                })
            }
            signal?.throwIfAborted()
        }
    }
}

export const runSeoAuditRequests = async (data, fetchResource, {
    signal, onProgress = () => {}, onUpdate = () => {}, pageLimit = DEFAULT_AUDIT_PAGE_LIMIT,
    getPageLimit = () => pageLimit, waitForResume = async () => {}, parseMeta = parseMetaHtml, parseSitemap = parseSitemapXml
} = {}) => {
    const pool = createAuditDiscovery(data), results = [], robotsUrl = new URL('/robots.txt', data.url).href
    let started = 0, finished = false, pagesPending = true, sitemapPending = true, sitemapSeen = 0
    let robotsFile = { url: robotsUrl, exists: false, status: 0, content: '', pending: true }, sitemap = emptySitemap()
    const sample = () => {
        const limit = normalizeAuditPageLimit(getPageLimit())
        return { ...pool.summary(), limit, urls: pool.urls.slice(0, Math.max(started, limit)) }
    }
    const snapshot = () => {
        const selected = sample()
        return { sample: selected, results: [...results].sort((a, b) => pool.order.get(a.url) - pool.order.get(b.url)), robotsFile, sitemap, pagesPending,
            partial: !finished || signal?.aborted === true || results.length < selected.urls.length }
    }
    const publish = () => {
        const value = snapshot()
        onProgress({ current: results.length, total: value.sample.urls.length, started })
        onUpdate(value)
    }
    const get = async (url, maxBytes = AUDIT_HTML_LIMIT, trace = false) => {
        await waitForResume(); signal?.throwIfAborted()
        try { return await fetchResource(url, 'GET', maxBytes, { trace, fresh: true }) }
        catch (error) { if (signal?.aborted) throw error; return { ...empty(url), failure: 'network' } }
    }
    publish()
    const pagesWork = async () => {
        while (true) {
            await waitForResume(); signal?.throwIfAborted()
            const batch = sample().urls.slice(started, started + 5)
            if (!batch.length) {
                // Sitemap may discover more addresses after the initial page queue is exhausted.
                if (sitemapPending && started < normalizeAuditPageLimit(getPageLimit())) { await sitemapTask; continue }
                pagesPending = false; publish(); return
            }
            started += batch.length; publish()
            const completed = await Promise.allSettled(batch.map(async url => {
                const info = await get(url, AUDIT_HTML_LIMIT, url === pool.urls[0])
                signal?.throwIfAborted()
                const { internalLinks = [], ...result } = inspectAuditPage(url, info, parseMeta)
                if (result.metaState === 'complete') {
                    pool.add(internalLinks)
                    if (result.finalUrl !== url) pool.add([result.finalUrl])
                }
                results.push(result); publish()
            }))
            const failure = completed.find(item => item.status === 'rejected')
            if (failure) throw failure.reason
        }
    }
    const sitemapWork = async () => {
        const info = await get(robotsUrl, 512 * 1024)
        signal?.throwIfAborted()
        robotsFile = { url: robotsUrl, exists: info.ok, status: info.status, content: info.text || '', truncated: info.truncated === true, failure: info.failure, pending: false }
        publish()
        const discoveryErrors = [], knownRobots = evaluateRobotsFile(robotsFile, data.url).allowed !== null
        const robotsContent = knownRobots && robotsFile.exists ? robotsFile.content : ''
        const declared = /^\s*sitemap\s*:/im.test(robotsContent)
        const roots = sitemapRoots(robotsContent, data.url, { onError: error => discoveryErrors.push(error) })
        await collectSitemap(roots, url => get(url, 8 * 1024 * 1024), {
            signal, parse: parseSitemap, waitForResume, onUpdate: combined => {
                pool.add(combined.pages.slice(sitemapSeen).map(item => item.url), 'sitemap')
                sitemapSeen = combined.pages.length
                const errors = [...discoveryErrors, ...combined.errors]
                const missing = !combined.pending && !combined.files.length && errors.length > 0 && errors.every(item => [404, 410].includes(item.status))
                const invalid = errors.some(item => item.kind === 'format' && (declared || /xml/i.test(item.contentType))) || (declared && missing)
                sitemap = { ...combined, errors, complete: combined.complete && !discoveryErrors.length && knownRobots,
                    state: invalid ? 'invalid' : missing ? 'missing' : combined.files.length ? 'valid' : 'unknown',
                    containsCurrent: combined.pages.some(item => withoutFragment(item.url) === withoutFragment(data.url)), roots, discoveryKnown: knownRobots }
                publish()
            }
        })
    }
    const sitemapTask = sitemapWork().finally(() => { sitemapPending = false })
    const work = await Promise.allSettled([pagesWork(), sitemapTask])
    robotsFile = { ...robotsFile, pending: false }
    sitemap = { ...sitemap, pending: false }
    finished = true; pagesPending = false
    const failure = work.find(item => item.status === 'rejected')
    if (failure && !signal?.aborted) throw failure.reason
    publish()
    return snapshot()
}

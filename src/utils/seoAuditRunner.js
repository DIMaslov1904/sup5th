import { collectSitemap, sitemapRoots, parseSitemapXml } from './sitemap.js'
import { evaluateRobotsFile, parseMetaHtml } from './seoRules.js'
import { inspectAuditPage, normalizeAuditPageLimit, AUDIT_HTML_LIMIT, DEFAULT_AUDIT_PAGE_LIMIT } from './seoAuditPages.js'
import { AUDIT_DISCOVERY_LIMIT, createAuditDiscovery } from './seoAuditDiscovery.js'
import { normalizeAuditMode, normalizeAuditUrl } from './seoAuditLinks.js'
import { createAuditIndexability } from './seoAuditIndexability.js'
import { createAuditFetch } from './seoAuditFetch.js'
import { withoutFragment } from './linkCheckStatus.js'
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
    getPageLimit = () => pageLimit, crawlPageLimit = DEFAULT_AUDIT_PAGE_LIMIT, mode = 'pages',
    getCrawlPageLimit = () => crawlPageLimit, waitForResume = async () => {}, parseMeta = parseMetaHtml, parseSitemap = parseSitemapXml, updateInterval = 100,
    excludeNonIndexable = true
} = {}) => {
    mode = normalizeAuditMode(mode)
    const exclusions = createAuditIndexability(data.url, { enabled: excludeNonIndexable })
    const pool = createAuditDiscovery(data, AUDIT_DISCOVERY_LIMIT, { mode, seedLinks: false, accept: exclusions.beforeRequest }), results = new Map(), pageResults = new Map()
    const started = new Set(), completed = new Set(), crawlStarted = new Set(), robotsUrl = new URL('/robots.txt', data.url).href
    const origin = new URL(data.url).origin
    let finished = false, targetsPending = true, crawlPending = mode === 'external', sitemapPending = true, sitemapSeen = 0
    let robotsFile = { url: robotsUrl, exists: false, status: 0, content: '', pending: true }, sitemap = emptySitemap()
    const sample = () => {
        const limit = normalizeAuditPageLimit(getPageLimit())
        const priority = mode === 'external' ? pool.urls : [...new Set([...pool.pageUrls, ...pool.urls])]
        const urls = [...started].filter(url => !exclusions.has(url))
        urls.push(...priority.filter(url => !started.has(url) && !exclusions.has(url)).slice(0, Math.max(0, limit - started.size)))
        return { ...pool.summary({ exclude: exclusions.has }), limit, urls }
    }
    const describeResult = result => {
        const details = pool.describe(result.url)
        return { ...details, ...result, kind: result.ok ? result.kind : details.kind || result.kind }
    }
    const snapshot = () => {
        const selected = sample(), crawlLimit = normalizeAuditPageLimit(mode === 'external' ? getCrawlPageLimit() : getPageLimit())
        const crawled = pageResults.size, discovered = pool.pageUrls.filter(url => !exclusions.has(url)).length
        const unavailable = [...pageResults.values()].filter(item => item.metaState === 'unavailable' && item.outcome !== 'broken').length
        const crawl = { current: crawled, started: crawlStarted.size, total: Math.min(discovered, crawlLimit), discovered, limit: crawlLimit,
            unavailable, pending: mode === 'external' ? crawlPending : targetsPending,
            complete: finished && !signal?.aborted && !selected.limited && !unavailable && crawled >= discovered && (sitemap.state === 'missing' || sitemap.complete) }
        return { mode, sample: selected, results: [...results.values()].sort((a, b) => pool.order.get(a.url) - pool.order.get(b.url)).map(describeResult),
            pageResults: [...pageResults.values()].map(describeResult), crawl, exclusions: exclusions.snapshot(), requests: completed.size,
            robotsFile, sitemap, pagesPending: targetsPending || crawlPending,
            partial: !finished || signal?.aborted === true || results.size < selected.urls.length }
    }
    let publishTimer = null, lastPublished = -Infinity
    const emit = () => {
        clearTimeout(publishTimer); publishTimer = null; lastPublished = performance.now()
        const value = snapshot()
        onUpdate(value)
    }
    const publish = (force = false) => {
        onProgress({ current: completed.size, total: Math.max(started.size, Math.min(pool.urls.filter(url => !exclusions.has(url)).length, normalizeAuditPageLimit(getPageLimit()))),
            started: started.size, crawl: { started: crawlStarted.size } })
        const remaining = Math.max(0, Number(updateInterval) || 0) - (performance.now() - lastPublished)
        if (force || remaining <= 0) { emit(); return }
        publishTimer ??= setTimeout(emit, remaining)
    }
    const get = createAuditFetch(fetchResource, { signal, waitForResume, exclusions, excludeNonIndexable })
    publish(true)
    const inspect = async url => {
        const info = await get(url, AUDIT_HTML_LIMIT, url === normalizeAuditUrl(data.url), true, true)
        signal?.throwIfAborted()
        const { internalLinks = [], auditLinks, ...result } = inspectAuditPage(url, info, parseMeta)
        if (!exclusions.afterResponse(result, pool.describe(url))) return null
        if (new URL(url).origin === origin) {
            if (pool.describe(url).kind === 'page') pageResults.set(url, result)
            if (result.metaState === 'complete' && new URL(result.finalUrl).origin === origin) {
                pool.add(auditLinks || internalLinks, 'links', result.finalUrl)
            }
        }
        return result
    }
    const batchWork = async (batch, destination) => {
        const settled = await Promise.allSettled(batch.map(async url => {
            const result = await inspect(url)
            if (destination === results) completed.add(url)
            if (result) destination.set(url, result)
            publish()
        }))
        const failure = settled.find(item => item.status === 'rejected')
        if (failure) throw failure.reason
    }
    const targetsWork = async () => {
        if (excludeNonIndexable) await robotsTask
        while (true) {
            await waitForResume(); signal?.throwIfAborted()
            const batch = sample().urls.filter(url => !started.has(url)).slice(0, 5)
            if (!batch.length) {
                if (mode === 'external' && crawlPending) { await crawlTask; continue }
                if (started.size < normalizeAuditPageLimit(getPageLimit())) {
                    if (sitemapPending) { await sitemapTask; continue }
                }
                targetsPending = false; publish(); return
            }
            if (mode === 'internal' && sitemapPending && batch.every(url => pool.describe(url).kind !== 'page')) { await sitemapTask; continue }
            for (const url of batch) { started.add(url); if (pool.describe(url).kind === 'page' && mode !== 'external') crawlStarted.add(url) }
            publish()
            await batchWork(batch, results)
        }
    }
    const crawlWork = async () => {
        if (excludeNonIndexable) await robotsTask
        while (true) {
            await waitForResume(); signal?.throwIfAborted()
            const remaining = normalizeAuditPageLimit(getCrawlPageLimit()) - crawlStarted.size
            const batch = pool.pageUrls.filter(url => !crawlStarted.has(url) && !exclusions.has(url)).slice(0, Math.max(0, Math.min(5, remaining)))
            if (!batch.length) {
                if (sitemapPending && remaining > 0) { await sitemapTask; continue }
                crawlPending = false; publish(); return
            }
            for (const url of batch) crawlStarted.add(url)
            publish()
            await batchWork(batch, pageResults)
        }
    }
    const robotsWork = async () => {
        const info = await get(robotsUrl, 512 * 1024)
        signal?.throwIfAborted()
        robotsFile = { url: robotsUrl, exists: info.ok, status: info.status, content: info.text || '', truncated: info.truncated === true, failure: info.failure, pending: false }
        exclusions.setRobots(robotsFile)
        if (excludeNonIndexable) {
            if (evaluateRobotsFile(robotsFile, data.url).allowed === null) throw new Error('Не удалось полностью прочитать robots.txt. Обход с исключением неиндексируемых страниц не начат.')
            for (const url of new Set([...pool.urls, ...pool.pageUrls])) exclusions.beforeRequest(url, pool.describe(url))
        }
        publish()
    }
    const sitemapWork = async () => {
        await robotsTask
        const discoveryErrors = [], knownRobots = evaluateRobotsFile(robotsFile, data.url).allowed !== null
        const robotsContent = knownRobots && robotsFile.exists ? robotsFile.content : ''
        const declared = /^\s*sitemap\s*:/im.test(robotsContent)
        const roots = sitemapRoots(robotsContent, data.url, { onError: error => discoveryErrors.push(error) })
        await collectSitemap(roots, url => get(url, 8 * 1024 * 1024, false, false, true), {
            signal, parse: parseSitemap, waitForResume, onUpdate: combined => {
                for (const item of combined.pages.slice(sitemapSeen)) pool.add([item.url], 'sitemap', item.source)
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
    const robotsTask = robotsWork()
    const sitemapTask = sitemapWork().finally(() => { sitemapPending = false })
    const crawlTask = mode === 'external' ? crawlWork() : Promise.resolve()
    const work = await Promise.allSettled([targetsWork(), crawlTask, sitemapTask])
    clearTimeout(publishTimer); publishTimer = null
    robotsFile = { ...robotsFile, pending: false }
    sitemap = { ...sitemap, pending: false }
    finished = true; targetsPending = false; crawlPending = false
    const failure = work.find(item => item.status === 'rejected')
    if (failure && !signal?.aborted) { publish(true); throw failure.reason }
    publish(true)
    return snapshot()
}

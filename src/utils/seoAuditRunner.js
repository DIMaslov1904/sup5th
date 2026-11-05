import { collectSitemap, sitemapRoots, parseSitemapXml } from './sitemap.js'
import { evaluateRobotsFile, parseMetaHtml } from './seoRules.js'
import { inspectAuditPage, normalizeAuditPageLimit, AUDIT_HTML_LIMIT, DEFAULT_AUDIT_PAGE_LIMIT } from './seoAuditPages.js'
import { AUDIT_DISCOVERY_LIMIT, createAuditDiscovery } from './seoAuditDiscovery.js'
import { normalizeAuditMode, normalizeAuditUrl } from './seoAuditLinks.js'
import { createAuditIndexability } from './seoAuditIndexability.js'
import { createAuditFetch } from './seoAuditFetch.js'
import { inspectAuditAvailability } from './seoAuditAvailability.js'
import { inspectAuditLlm } from './seoAuditLlm.js'
import { withoutFragment } from './linkCheckStatus.js'
const emptySitemap = () => ({ state: 'unknown', files: [], pages: [], errors: [], duplicates: 0, duplicateUrls: [], pending: true, complete: false, containsCurrent: false })

export { createAuditControl } from './seoAuditControl.js'

// New URLs append to their priority lists. Only skip entries that will stay unavailable.
const pendingUrls = (lists, unavailable) => {
    const cursors = lists.map(() => 0)
    return limit => {
        const selected = []
        if (limit <= 0) return selected
        for (const [index, urls] of lists.entries()) {
            let first = cursors[index]
            while (first < urls.length && unavailable(urls[first])) first++
            cursors[index] = first
            for (let i = first; i < urls.length && selected.length < limit; i++) {
                if (!unavailable(urls[i])) selected.push(urls[i])
            }
            if (selected.length >= limit) break
        }
        return selected
    }
}

export const runSeoAuditRequests = async (data, fetchResource, {
    signal, onProgress = () => { }, onUpdate = () => { }, pageLimit = DEFAULT_AUDIT_PAGE_LIMIT,
    getPageLimit = () => pageLimit, crawlPageLimit = DEFAULT_AUDIT_PAGE_LIMIT, mode = 'pages',
    getCrawlPageLimit = () => crawlPageLimit, waitForResume = async () => { }, parseMeta = parseMetaHtml, parseSitemap = parseSitemapXml, updateInterval = 100,
    excludeNonIndexable = true, customExclusions = ''
} = {}) => {
    mode = normalizeAuditMode(mode)
    let pool
    const exclusions = createAuditIndexability(data.url, { enabled: excludeNonIndexable, customExclusions, maxExcluded: Infinity, onExclude: url => pool?.exclude(url) })
    pool = createAuditDiscovery(data, AUDIT_DISCOVERY_LIMIT, { mode, seedLinks: true, accept: exclusions.beforeRequest })
    const results = new Map(), pageResults = new Map()
    const started = new Set(), completed = new Set(), crawlStarted = new Set(), robotsUrl = new URL('/robots.txt', data.url).href
    const origin = new URL(data.url).origin, currentUrl = normalizeAuditUrl(data.url)
    const targets = pendingUrls(mode === 'external' ? [pool.otherUrls] : [pool.pageUrls, pool.otherUrls], url => started.has(url) || exclusions.has(url))
    const crawlTargets = pendingUrls([pool.pageUrls], url => crawlStarted.has(url) || exclusions.has(url))
    let finished = false, targetsPending = true, crawlPending = mode === 'external', sitemapPending = true, sitemapSeen = 0
    let robotsFile = { url: robotsUrl, exists: false, status: 0, content: '', pending: true }, sitemap = emptySitemap()
    const llmUrl = new URL('/llm.txt', data.url).href
    let llmTxt = { url: llmUrl, exists: false, status: 0, pending: mode !== 'external', skipped: mode === 'external' }
    const sample = () => {
        const limit = normalizeAuditPageLimit(getPageLimit())
        const urls = [...started].filter(url => !exclusions.has(url))
        const pending = targets(limit - started.size)
        return { ...pool.summary(), limit, urls: urls.concat(pending) }
    }
    const describeResult = result => {
        const details = pool.describe(result.url)
        return { ...details, ...result, kind: result.ok ? result.kind : details.kind || result.kind }
    }
    const snapshot = () => {
        const selected = sample(), crawlLimit = normalizeAuditPageLimit(mode === 'external' ? getCrawlPageLimit() : getPageLimit())
        const crawled = pageResults.size, discovered = selected.pageTotal
        const unavailable = [...pageResults.values()].filter(item => item.metaState === 'unavailable' && item.outcome !== 'broken').length
        const crawl = {
            current: crawled, started: crawlStarted.size, total: Math.min(discovered, crawlLimit), discovered, limit: crawlLimit,
            unavailable, pending: mode === 'external' ? crawlPending : targetsPending,
            complete: finished && !signal?.aborted && !selected.limited && !unavailable && crawled >= discovered && (sitemap.state === 'missing' || sitemap.complete)
        }
        return {
            mode, sample: selected, results: [...results.values()].sort((a, b) => pool.order.get(a.url) - pool.order.get(b.url)).map(describeResult),
            pageResults: [...pageResults.values()].map(describeResult), crawl, exclusions: exclusions.snapshot(), requests: completed.size,
            robotsFile, sitemap, llmTxt, pagesPending: targetsPending || crawlPending,
            partial: !finished || signal?.aborted === true || results.size < selected.urls.length
        }
    }
    let publishTimer = null, lastPublished = -Infinity
    const emit = () => {
        clearTimeout(publishTimer); publishTimer = null; lastPublished = performance.now()
        const value = snapshot()
        onUpdate(value)
    }
    const publish = (force = false) => {
        onProgress({
            current: completed.size, total: Math.max(started.size, Math.min(pool.counts.total, normalizeAuditPageLimit(getPageLimit()))),
            started: started.size, crawl: { started: crawlStarted.size }
        })
        const remaining = Math.max(0, Number(updateInterval) || 0) - (performance.now() - lastPublished)
        if (force || remaining <= 0) { emit(); return }
        publishTimer ??= setTimeout(emit, remaining)
    }
    const get = createAuditFetch(fetchResource, { signal, waitForResume, exclusions, excludeNonIndexable })
    const head = createAuditFetch(fetchResource, { signal, waitForResume, exclusions, excludeNonIndexable, method: 'HEAD', followRedirects: false })
    // Динамический размер батча по скользящему среднему TTFB: быстрый сервер — больший батч, медленный — меньший
    let ttfbSamples = []
    const recordTtfb = info => {
        if (!Number.isFinite(info?.ttfb)) return
        ttfbSamples = [...ttfbSamples, info.ttfb].slice(-5)
    }
    const batchSize = () => {
        if (!ttfbSamples.length) return 5
        const average = ttfbSamples.reduce((sum, value) => sum + value, 0) / ttfbSamples.length
        return average < 500 ? 10 : average <= 1500 ? 5 : 2
    }
    publish(true)
    const inspect = async url => {
        if (mode === 'external' && new URL(url).origin !== origin) {
            const info = await head(url, 1000, true, false, true)
            signal?.throwIfAborted()
            recordTtfb(info)
            return info.excludedRedirect ? null : inspectAuditAvailability(url, info)
        }
        const info = await get(url, AUDIT_HTML_LIMIT, url === currentUrl, true, true)
        signal?.throwIfAborted()
        recordTtfb(info)
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
            const batch = targets(Math.min(batchSize(), normalizeAuditPageLimit(getPageLimit()) - started.size))
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
            const batch = crawlTargets(Math.min(batchSize(), remaining))
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
            for (const url of pool.urls()) exclusions.beforeRequest(url, pool.describe(url))
        }
        publish()
    }
    const sitemapWork = async () => {
        await robotsTask
        const discoveryErrors = [], knownRobots = evaluateRobotsFile(robotsFile, data.url).allowed !== null
        const robotsContent = knownRobots && robotsFile.exists ? robotsFile.content : ''
        const sourceUrl = withoutFragment(data.url)
        const declared = /^\s*sitemap\s*:/im.test(robotsContent)
        const roots = sitemapRoots(robotsContent, data.url, { onError: error => discoveryErrors.push(error) })
        await collectSitemap(roots, url => get(url, 8 * 1024 * 1024, false, false, true), {
            signal, parse: parseSitemap, waitForResume, maxUrls: Infinity, maxFiles: Infinity, onUpdate: combined => {
                let containsCurrent = sitemap.containsCurrent
                for (const item of combined.pages.slice(sitemapSeen)) {
                    pool.add([item.url], 'sitemap', item.source)
                    containsCurrent ||= withoutFragment(item.url) === sourceUrl
                }
                sitemapSeen = combined.pages.length
                const errors = [...discoveryErrors, ...combined.errors]
                const missing = !combined.pending && !combined.files.length && errors.length > 0 && errors.every(item => [404, 410].includes(item.status))
                const invalid = errors.some(item => item.kind === 'format' && (declared || /xml/i.test(item.contentType))) || (declared && missing)
                sitemap = {
                    ...combined, errors, complete: combined.complete && !discoveryErrors.length && knownRobots,
                    state: invalid ? 'invalid' : missing ? 'missing' : combined.files.length ? 'valid' : 'unknown',
                    containsCurrent, roots, discoveryKnown: knownRobots
                }
                publish()
            }
        })
    }
    const robotsTask = robotsWork()
    const sitemapTask = sitemapWork().finally(() => { sitemapPending = false })
    const llmTask = (async () => {
        if (mode === 'external') return
        const info = await get(llmUrl, 256 * 1024)
        signal?.throwIfAborted()
        llmTxt = inspectAuditLlm(llmUrl, info)
        publish()
    })()
    const crawlTask = mode === 'external' ? crawlWork() : Promise.resolve()
    const work = await Promise.allSettled([targetsWork(), crawlTask, sitemapTask, llmTask])
    clearTimeout(publishTimer); publishTimer = null
    if (robotsFile.pending) robotsFile = { ...robotsFile, pending: false }
    sitemap = { ...sitemap, pending: false }
    llmTxt = { ...llmTxt, pending: false }
    finished = true; targetsPending = false; crawlPending = false
    const failure = work.find(item => item.status === 'rejected')
    if (failure && !signal?.aborted) { publish(true); throw failure.reason }
    publish(true)
    return snapshot()
}

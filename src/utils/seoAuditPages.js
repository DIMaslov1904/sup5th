import { classifyLinkCheck } from './linkCheckStatus.js'
import { parseMetaHtml } from './seoRules.js'
import { normalizeAuditUrl as normalizeUrl } from './seoAuditDiscovery.js'
export const AUDIT_PAGE_LIMIT = 5000
export const DEFAULT_AUDIT_PAGE_LIMIT = 100
export const AUDIT_HTML_LIMIT = 1024 * 1024
export const normalizeAuditPageLimit = count => Number.isFinite(Number(count)) ? Math.max(1, Math.min(AUDIT_PAGE_LIMIT, Math.trunc(Number(count)))) : DEFAULT_AUDIT_PAGE_LIMIT
export const normalizeAuditText = value => String(value || '').normalize('NFC').replace(/\s+/g, ' ').trim()
export const createAuditSample = (data, count = DEFAULT_AUDIT_PAGE_LIMIT) => {
    const limit = normalizeAuditPageLimit(count)
    const current = normalizeUrl(data.url), origin = new URL(current).origin
    const urls = [...new Set([current, ...(data.internalLinks || [])].map(value => normalizeUrl(value)).filter(value => value && new URL(value).origin === origin))]
    return { urls: urls.slice(0, limit), limit, total: urls.length }
}
export const filterAuditPages = (results, filter = 'all') => filter === '4xx' ? results.filter(item => item.status >= 400 && item.status < 500)
    : filter === '5xx' ? results.filter(item => item.status >= 500 && item.status < 600) : results
export const inspectAuditPage = (url, info, parse = parseMetaHtml) => {
    const finalUrl = normalizeUrl(info.url) || normalizeUrl(url)
    const response = { status: info.status || 0, ok: info.ok === true, url: finalUrl, headers: info.headers || {}, ttfb: info.ttfb ?? null, failure: info.failure, truncated: info.truncated === true, xRobotsTags: info.xRobotsTags, chain: info.chain || [] }
    const result = { url, finalUrl, response, status: response.status, ok: response.ok, ...classifyLinkCheck(info), redirected: info.status ? finalUrl !== normalizeUrl(url) || response.chain.some(hop => hop.redirectUrl) : null, ttfb: response.ttfb, metaState: 'unavailable', metaReason: '', title: '', description: '' }
    const mime = String(response.headers['content-type'] || '').split(';')[0].trim().toLowerCase()
    if (!info.ok || info.status !== 200) result.metaReason = 'Полный HTML-ответ HTTP 200 не получен'
    else if (!['text/html', 'application/xhtml+xml'].includes(mime)) { result.metaState = mime ? 'non-html' : 'unavailable'; result.metaReason = mime ? `Тип ответа: ${mime}` : 'Тип ответа не указан' }
    else if (info.truncated) result.metaReason = 'HTML обрезан при загрузке'
    else if (new URL(finalUrl).origin !== new URL(url).origin) result.metaReason = 'Конечный URL вне области проверки'
    else {
        try { const meta = parse(info.text || '', finalUrl); Object.assign(result, { metaState: 'complete', title: normalizeAuditText(meta.title), description: normalizeAuditText(meta.description), indexingMeta: meta.indexingMeta || [], internalLinks: meta.internalLinks || [] }) }
        catch { result.metaReason = 'Не удалось прочитать метаданные HTML' }
    }
    return result
}
export const summarizeAuditPages = results => {
    const pages = [...new Map(results.filter(item => item.metaState === 'complete').map(item => [item.finalUrl, item])).values()]
    const groups = field => {
        const values = new Map()
        for (const item of pages) if (item[field]) { const urls = values.get(item[field]) || []; urls.push(item.finalUrl); values.set(item[field], urls) }
        return [...values].filter(([, urls]) => urls.length > 1).map(([value, urls]) => ({ value, urls }))
    }
    return { htmlCount: pages.length, titleCount: pages.filter(item => item.title).length, descriptionCount: pages.filter(item => item.description).length,
        duplicateTitles: groups('title'), duplicateDescriptions: groups('description'),
        clientErrors: filterAuditPages(results, '4xx').length,
        broken: results.filter(item => item.outcome === 'broken').length, serverErrors: filterAuditPages(results, '5xx').length,
        uncertain: results.filter(item => !['ok', 'broken', 'server'].includes(item.outcome)).length }
}

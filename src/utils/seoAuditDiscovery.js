import { auditUrlKind, normalizeAuditMode, normalizeAuditUrl } from './seoAuditLinks.js'
export { collectAuditLinks, normalizeAuditUrl } from './seoAuditLinks.js'
export const AUDIT_DISCOVERY_LIMIT = Infinity

export const createAuditDiscovery = (data, maxUrls = AUDIT_DISCOVERY_LIMIT, { mode = 'pages', seedLinks = true, accept = () => true } = {}) => {
    mode = normalizeAuditMode(mode)
    const origin = new URL(data.url).origin, urls = [], pageUrls = [], order = new Map(), entries = new Map()
    let limited = false
    const add = (values, source = 'links', sourceUrl = '') => {
        for (const value of values) {
            const url = normalizeAuditUrl(typeof value === 'string' ? value : value?.url, sourceUrl || data.url)
            if (!url) continue
            const external = new URL(url).origin !== origin
            if (source === 'sitemap' && external) continue
            const kind = url === normalizeAuditUrl(data.url) ? 'page' : value.kind || auditUrlKind(url)
            if (mode === 'pages' && (external || kind !== 'page')) continue
            if (mode === 'internal' && external) continue
            if (mode === 'external' && !external && kind !== 'page') continue
            if (!accept(url, { source, sourceUrl, kind })) continue
            let entry = entries.get(url)
            if (!entry) {
                if (entries.size >= maxUrls) { limited = true; continue }
                entry = { url, kind, external, sources: new Set(), sitemaps: new Set(), current: source === 'current', linked: false, mapped: false }
                entries.set(url, entry)
                if (!external && kind === 'page') pageUrls.push(url)
                if (mode !== 'external' || external) { order.set(url, urls.length); urls.push(url) }
            }
            entry.linked ||= source === 'links' || source === 'current'
            entry.mapped ||= source === 'sitemap'
            const referrer = normalizeAuditUrl(sourceUrl)
            if (source === 'links' && referrer && !entry.sources.has(referrer)) { entry.sources.add(referrer); entry.description = null }
            if (source === 'sitemap' && referrer && !entry.sitemaps.has(referrer)) { entry.sitemaps.add(referrer); entry.description = null }
        }
    }
    const describe = url => {
        const entry = entries.get(url)
        if (!entry) return {}
        return entry.description ||= { kind: entry.kind, external: entry.external, sources: [...entry.sources], sitemaps: [...entry.sitemaps], current: entry.current }
    }
    const summary = ({ exclude = () => false } = {}) => {
        const targets = urls.filter(url => !exclude(url)).map(url => entries.get(url))
        return { mode, total: targets.length, pageTotal: pageUrls.filter(url => !exclude(url)).length, linked: targets.filter(item => item.linked).length,
            mapped: targets.filter(item => item.mapped).length, outsideSitemap: targets.filter(item => item.linked && !item.mapped).length, limited }
    }
    add([data.url], 'current')
    const initial = data.auditLinks || [
        ...(data.internalLinks || []), ...(data.linkRows || []).map(item => item.url),
        ...(data.imageRows || []).map(item => ({ url: item.src, kind: 'image' }))
    ]
    if (seedLinks && entries.has(normalizeAuditUrl(data.url))) {
        add(initial, 'links', data.url)
        if (data.auditLinks ? data.auditLinksTotal > data.auditLinks.length : (data.internalLinksTotal || 0) > (data.internalLinks || []).length) limited = true
    }
    return { urls, pageUrls, order, add, describe, summary }
}

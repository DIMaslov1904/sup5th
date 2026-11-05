import { auditUrlKind, normalizeAuditMode, normalizeAuditUrl } from './seoAuditLinks.js'
export const AUDIT_DISCOVERY_LIMIT = Infinity

export const createAuditDiscovery = (data, maxUrls = AUDIT_DISCOVERY_LIMIT, { mode = 'pages', seedLinks = true, accept = () => true } = {}) => {
    mode = normalizeAuditMode(mode)
    const origin = new URL(data.url).origin, current = normalizeAuditUrl(data.url)
    const pageUrls = [], otherUrls = [], order = new Map(), entries = new Map()
    const counts = { total: 0, pageTotal: 0, linked: 0, mapped: 0, outsideSitemap: 0 }
    let limited = false
    const count = (entry, delta) => {
        if (entry.page) counts.pageTotal += delta
        if (!entry.target) return
        counts.total += delta
        if (entry.linked) counts.linked += delta
        if (entry.mapped) counts.mapped += delta
        if (entry.linked && !entry.mapped) counts.outsideSitemap += delta
    }
    const add = (values, source = 'links', sourceUrl = '') => {
        const linked = source === 'links' || source === 'current', mapped = source === 'sitemap'
        const referrer = normalizeAuditUrl(sourceUrl)
        for (const value of values) {
            const url = normalizeAuditUrl(typeof value === 'string' ? value : value?.url, sourceUrl || data.url)
            if (!url) continue
            const external = new URL(url).origin !== origin
            if (source === 'sitemap' && external) continue
            const kind = url === current ? 'page' : value.kind || auditUrlKind(url)
            if (mode === 'pages' && (external || kind !== 'page')) continue
            if (mode === 'internal' && external) continue
            if (mode === 'external' && !external && kind !== 'page') continue
            if (!accept(url, { source, sourceUrl, kind })) continue
            let entry = entries.get(url)
            if (!entry) {
                if (entries.size >= maxUrls) { limited = true; continue }
                const page = !external && kind === 'page', target = mode !== 'external' || external
                entry = { kind, external, page, target, sources: new Set(), sitemaps: new Set(), current: source === 'current', linked, mapped }
                entries.set(url, entry)
                if (page) pageUrls.push(url)
                else otherUrls.push(url)
                if (target) order.set(url, order.size)
                count(entry, 1)
            } else if (linked && !entry.linked || mapped && !entry.mapped) {
                count(entry, -1)
                entry.linked ||= linked
                entry.mapped ||= mapped
                count(entry, 1)
            }
            if (source === 'links' && referrer && !entry.sources.has(referrer)) { entry.sources.add(referrer); entry.description = null }
            if (source === 'sitemap' && referrer && !entry.sitemaps.has(referrer)) { entry.sitemaps.add(referrer); entry.description = null }
        }
    }
    const describe = url => {
        const entry = entries.get(url)
        if (!entry) return {}
        return entry.description ||= { kind: entry.kind, external: entry.external, sources: [...entry.sources], sitemaps: [...entry.sitemaps], current: entry.current }
    }
    const exclude = url => { const entry = entries.get(url); if (entry) count(entry, -1) }
    add([data.url], 'current')
    const initial = data.auditLinks || [
        ...(data.internalLinks || []), ...(data.linkRows || []).map(item => item.url),
        ...(data.imageRows || []).map(item => ({ url: item.src, kind: 'image' }))
    ]
    if (seedLinks && entries.has(current)) {
        add(initial, 'links', data.url)
        if (data.auditLinks ? data.auditLinksTotal > data.auditLinks.length : (data.internalLinksTotal || 0) > (data.internalLinks || []).length) limited = true
    }
    return { pageUrls, otherUrls, order, add, describe, exclude, counts, urls: () => entries.keys(), summary: () => ({ mode, ...counts, limited }) }
}

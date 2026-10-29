export const AUDIT_DISCOVERY_LIMIT = 50000

export const normalizeAuditUrl = (value, base) => {
    try {
        const url = new URL(value, base)
        if (!/^https?:$/.test(url.protocol) || url.username || url.password) return ''
        url.hash = ''; return url.href
    } catch { return '' }
}

export const collectAuditLinks = (doc, pageUrl) => {
    let base = pageUrl
    try { base = new URL(doc.querySelector('base[href]')?.getAttribute('href') || pageUrl, pageUrl).href } catch { /* Use the response URL. */ }
    const origin = new URL(pageUrl).origin
    return [...new Set([...doc.querySelectorAll('a[href], area[href]')].map(link => normalizeAuditUrl(link.getAttribute('href'), base))
        .filter(url => url && new URL(url).origin === origin))]
}

export const createAuditDiscovery = (data, maxUrls = AUDIT_DISCOVERY_LIMIT) => {
    const origin = new URL(data.url).origin, urls = [], order = new Map(), linked = new Set(), mapped = new Set()
    let limited = false, overlap = 0
    const add = (values, source = 'links') => {
        const target = source === 'sitemap' ? mapped : linked, other = source === 'sitemap' ? linked : mapped
        for (const value of values) {
            const url = normalizeAuditUrl(value)
            if (!url || new URL(url).origin !== origin) continue
            if (!order.has(url)) {
                if (urls.length >= maxUrls) { limited = true; continue }
                order.set(url, urls.length); urls.push(url)
            }
            if (!target.has(url) && other.has(url)) overlap++
            target.add(url)
        }
    }
    add([data.url, ...(data.internalLinks || [])])
    if ((data.internalLinksTotal || 0) > (data.internalLinks || []).length) limited = true
    return { urls, order, add, summary: () => ({ total: urls.length, linked: linked.size, mapped: mapped.size, outsideSitemap: linked.size - overlap, limited }) }
}

const httpUrl = (raw, base) => {
    const url = new URL(raw, base)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Некорректный URL sitemap')
    url.hash = ''; return url.href
}
export const parseSitemapXml = (text, base) => {
    const doc = new DOMParser().parseFromString(text, 'application/xml')
    if (doc.querySelector('parsererror')) throw new Error('Некорректный XML sitemap')
    const root = doc.documentElement.localName
    if (!['sitemapindex', 'urlset'].includes(root)) throw new Error('Ответ не является sitemap (ожидался XML)')
    const kind = root === 'sitemapindex' ? 'sitemap' : 'url'
    const records = [...doc.documentElement.children].filter(el => el.localName === kind).map(el => {
        const field = name => [...el.children].find(child => child.localName === name)?.textContent.trim() || ''
        const location = field('loc')
        if (!location) throw new Error('В записи sitemap отсутствует loc')
        return { url: httpUrl(location, base), lastmod: field('lastmod') }
    })
    return { index: root === 'sitemapindex', records }
}
export const collectSitemap = async (roots, fetchDocument, { parse = parseSitemapXml, maxFiles = 200, maxUrls = 50000, signal, onProgress = () => {} } = {}) => {
    const queue = [...new Set(roots.map(url => httpUrl(url)))], visited = new Set(), pages = new Map(), files = [], errors = []
    let duplicates = 0, limited = false
    while (queue.length) {
        signal?.throwIfAborted()
        if (visited.size >= maxFiles || pages.size >= maxUrls) { limited = true; break }
        const url = queue.shift(); if (visited.has(url)) continue
        visited.add(url)
        try {
            const response = await fetchDocument(url)
            signal?.throwIfAborted()
            if (!response.ok) throw new Error(`HTTP ${response.status || 'не получен'}`)
            if (response.truncated) throw new Error('Файл превышает лимит загрузки; данные неполные')
            const doc = parse(response.text, response.url || url)
            files.push({ url, count: doc.records.length, index: doc.index })
            for (const record of doc.records) {
                if (doc.index) { if (!visited.has(record.url)) queue.push(record.url) }
                else if (pages.has(record.url)) duplicates++
                else if (pages.size < maxUrls) pages.set(record.url, { ...record, source: url })
                else limited = true
            }
        } catch (error) {
            if (signal?.aborted) throw error
            errors.push({ url, message: error.message })
        }
        onProgress({ files: visited.size, urls: pages.size })
    }
    return { pages: [...pages.values()], files, errors, duplicates, limited, complete: !limited && !errors.length }
}
export const sitemapRoots = (robots, siteUrl) => {
    const urls = [...String(robots || '').matchAll(/^\s*sitemap\s*:\s*(\S+)/gim)].map(x => httpUrl(x[1], siteUrl))
    return urls.length ? [...new Set(urls)] : [new URL('/sitemap.xml', siteUrl).href]
}

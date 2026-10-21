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
export const collectSitemap = async (roots, fetchDocument, { parse = parseSitemapXml, maxFiles = 200, maxUrls = 50000, signal, onProgress = () => {}, onUpdate = () => {}, waitForResume = async () => {} } = {}) => {
    const queue = [...new Set(roots.map(url => httpUrl(url)))], visited = new Set(), pages = new Map(), files = [], errors = []
    const duplicateUrls = new Map()
    let duplicates = 0, limited = false
    const snapshot = pending => ({ pages: [...pages.values()], files: [...files], errors: [...errors], duplicates,
        duplicateUrls: [...duplicateUrls.values()].map(item => ({ ...item, sources: [...item.sources] })),
        limited, pending, complete: !pending && !limited && !errors.length })
    onUpdate(snapshot(true))
    while (queue.length) {
        await waitForResume()
        signal?.throwIfAborted()
        if (visited.size >= maxFiles || pages.size >= maxUrls) { limited = true; break }
        const url = queue.shift(); if (visited.has(url)) continue
        visited.add(url)
        let status = 0, contentType = '', kind = 'http', failure = ''
        try {
            const response = await fetchDocument(url)
            status = response.status || 0; contentType = response.headers?.['content-type'] || ''; failure = response.failure || ''
            signal?.throwIfAborted()
            if (response.failure === 'permission') throw new Error('Нет разрешения на сайт. Предоставьте доступ и повторите загрузку.')
            if (!response.ok) throw new Error(`HTTP ${response.status || 'не получен'}`)
            if (response.truncated || response.status === 206) { kind = 'truncated'; throw new Error('Получена только часть файла sitemap') }
            kind = 'format'
            const doc = parse(response.text, response.url || url)
            files.push({ url, finalUrl: response.url || url, status: response.status, count: doc.records.length, index: doc.index })
            for (const record of doc.records) {
                if (doc.index) { if (!visited.has(record.url)) queue.push(record.url) }
                else if (pages.has(record.url)) {
                    duplicates++
                    const repeated = duplicateUrls.get(record.url) || { url: record.url, count: 1, sources: new Set([pages.get(record.url).source]) }
                    repeated.count++; repeated.sources.add(url); duplicateUrls.set(record.url, repeated)
                }
                else if (pages.size < maxUrls) pages.set(record.url, { ...record, source: url })
                else limited = true
            }
        } catch (error) {
            if (signal?.aborted) throw error
            errors.push({ url, message: error.message, status, contentType, kind, failure })
        }
        onProgress({ files: visited.size, urls: pages.size })
        onUpdate(snapshot(true))
    }
    const result = snapshot(false)
    onUpdate(result)
    return result
}
export const sitemapRoots = (robots, siteUrl, { onError = () => {} } = {}) => {
    const urls = []
    for (const match of String(robots || '').matchAll(/^\s*sitemap\s*:\s*(\S+)/gim)) {
        try { urls.push(httpUrl(match[1], siteUrl)) }
        catch (error) { onError({ url: match[1], message: error.message, kind: 'declaration', status: 0 }) }
    }
    return urls.length ? [...new Set(urls)] : [new URL('/sitemap.xml', siteUrl).href]
}

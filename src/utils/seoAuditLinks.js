import { seoDocumentBase } from './seoDom.js'

export const AUDIT_MODES = [
    { value: 'pages', label: 'Страницы', hint: 'Обход внутренних страниц и sitemap. Известные файлы и ресурсы пропускаются; llm.txt проверяется отдельно.' },
    { value: 'internal', label: 'Внутренние ссылки', hint: 'Проверка страниц, документов, изображений и ресурсов. llm.txt проверяется отдельно.' },
    { value: 'external', label: 'Внешние ссылки', hint: 'Внутренние страницы используются для поиска ссылок. Каждый внешний URL получает один HEAD-запрос без перехода по редиректам и повторного GET. В отчёте — только ответ и Location.' }
]
export const normalizeAuditMode = mode => AUDIT_MODES.some(item => item.value === mode) ? mode : 'pages'
export const normalizeAuditUrl = (value, base) => {
    try {
        if (!String(value || '').trim()) return ''
        const url = new URL(value, base)
        if (!/^https?:$/.test(url.protocol) || url.username || url.password) return ''
        url.hash = ''; return url.href
    } catch { return '' }
}
export const auditUrlKind = value => {
    let path
    try { path = decodeURIComponent(new URL(value).pathname).toLowerCase() } catch { return 'page' }
    if (/\.(?:avif|apng|bmp|gif|ico|jpe?g|png|svg|tiff?|webp|heic)$/.test(path)) return 'image'
    if (/\.(?:pdf|docx?|xlsx?|pptx?|od[ptsg]|rtf|txt|csv|epub|djvu|zip|rar|7z|tar|gz|bz2|xz|exe|dmg|apk|iso)$/.test(path)) return 'document'
    if (/\.(?:[cm]?js|css|map|json|xml|rss|atom|woff2?|ttf|otf|eot|mp[34]|m4[av]|webm|ogg|og[av]|wav|flac|aac|avi|mov|mpe?g|swf|wasm|webmanifest)$/.test(path)) return 'resource'
    return 'page'
}

// Commas inside srcset URLs (notably data: URLs) are not candidate separators.
export const auditSrcsetUrls = value => {
    const urls = [], input = String(value || '')
    let index = 0
    while (index < input.length) {
        while (index < input.length && /[\s,]/.test(input[index])) index++
        const start = index
        while (index < input.length && !/\s/.test(input[index])) index++
        const token = input.slice(start, index)
        if (!token) break
        urls.push(token.replace(/,+$/, ''))
        if (token.endsWith(',')) continue
        let parentheses = 0
        while (index < input.length) {
            const char = input[index++]
            if (char === '(') parentheses++
            if (char === ')') parentheses = Math.max(0, parentheses - 1)
            if (char === ',' && !parentheses) break
        }
    }
    return urls
}

export const collectAuditTargets = (doc, pageUrl) => {
    const base = seoDocumentBase(doc, pageUrl)
    const targets = new Map()
    const add = (raw, kind) => {
        const url = normalizeAuditUrl(raw, base)
        if (!url) return
        const inferred = auditUrlKind(url)
        const target = { url, kind: inferred !== 'page' ? inferred : kind || 'page' }
        const existing = targets.get(url)
        if (!existing || existing.kind === 'page') targets.set(url, target)
    }
    for (const link of doc.querySelectorAll('a[href]:not([data-sup-seo-download]), area[href]')) add(link.getAttribute('href'), link.hasAttribute('download') ? 'document' : 'page')
    for (const image of doc.querySelectorAll('img, input[type="image" i]')) {
        for (const raw of [image.currentSrc, image.getAttribute('src'), image.getAttribute('data-src'), image.getAttribute('data-original')]) add(raw, 'image')
        for (const raw of auditSrcsetUrls(image.getAttribute('srcset') || image.getAttribute('data-srcset'))) add(raw, 'image')
    }
    for (const source of doc.querySelectorAll('source')) {
        const kind = source.closest('picture') ? 'image' : 'resource'
        add(source.getAttribute('src'), kind)
        for (const raw of auditSrcsetUrls(source.getAttribute('srcset') || source.getAttribute('data-srcset'))) add(raw, kind)
    }
    for (const element of doc.querySelectorAll('script[src], video[src], audio[src], track[src], embed[src], iframe[src], object[data], video[poster]')) {
        add(element.getAttribute('src') || element.getAttribute('data'), element.tagName === 'IFRAME' ? 'page' : 'resource')
        add(element.getAttribute('poster'), 'image')
    }
    for (const link of doc.querySelectorAll('link[href]')) {
        if (/\b(?:stylesheet|icon|preload|modulepreload|manifest|apple-touch-icon)\b/i.test(link.rel || '')) {
            add(link.getAttribute('href'), /icon/i.test(link.rel) || link.getAttribute('as') === 'image' ? 'image' : 'resource')
        }
    }
    return [...targets.values()]
}

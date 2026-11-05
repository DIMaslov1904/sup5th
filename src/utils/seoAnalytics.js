const names = {
    metrika: 'Яндекс Метрика',
    ga: 'Google Analytics',
    gtm: 'Google Tag Manager',
    googleTag: 'Google tag',
    googleAds: 'Google Ads',
    meta: 'Meta Pixel (Facebook)',
    mailVk: 'VK Реклама / Top.Mail.Ru / MyTracker',
    vk: 'VK Ретаргетинг',
    liveInternet: 'LiveInternet',
    rambler: 'Рамблер/Топ-100',
    roistat: 'Roistat'
}

const numericId = value => /^\d{1,24}$/.test(value || '') ? value : ''
const vkId = value => /^VK-RTRG-\d+-[a-z\d]+$/i.test(value || '') ? value : ''
const gtmId = value => /^GTM-[A-Z\d]+$/.test(value || '') ? value : ''

const googleId = id => {
    if (/^(?:G-[A-Z\d]+|UA-\d+-\d+)$/.test(id)) return 'ga'
    if (/^GT-[A-Z\d]+$/.test(id)) return 'googleTag'
    if (/^AW-\d+$/.test(id)) return 'googleAds'
    return ''
}

const urlRules = [
    [/^(?:mc\.yandex\.(?:ru|com|by|kz|uz)|mc\.webvisor\.(?:com|org))$/, /^\/(?:metrika\/(?:tag|watch)\.js|watch\/(\d+))$/, 'metrika',
        (url, match) => numericId(match[1] || url.searchParams.get('id'))],
    [/^(?:www\.)?googletagmanager\.com$/, /^\/(?:gtm\.js|ns\.html)$/, 'gtm', url => gtmId(url.searchParams.get('id'))],
    [/^(?:www\.)?googletagmanager\.com$/, /^\/gtag\/(?:js|destination)$/, '', url => url.searchParams.get('id') || ''],
    [/^(?:(?:[a-z\d-]+\.)?google-analytics\.com|analytics\.google\.com)$/, /^\/(?:analytics\.js|ga\.js|(?:[gjr]\/)?collect)$/, 'ga',
        url => googleId(url.searchParams.get('tid') || '') === 'ga' ? url.searchParams.get('tid') : ''],
    [/^connect\.facebook\.net$/, /^\/[^/]+\/fbevents\.js$/, 'meta'],
    [/^(?:www\.)?facebook\.com$/, /^\/tr\/?$/, 'meta', url => numericId(url.searchParams.get('id'))],
    [/^(?:top-fwz1\.mail\.ru|mytopf\.com)$/, /^\/(?:js\/code(?:-fb)?\.js|counter|tracker|pixel)$/, 'mailVk',
        url => numericId(url.search.match(/[?&;]id=(\d+)(?=[&;]|$)/)?.[1])],
    [/^(?:www\.)?(?:vk\.com|vk\.ru)$/, /^\/rtrg\/?$/, 'vk', url => vkId(url.searchParams.get('p'))],
    [/^counter\.yadro\.ru$/, /^\/hit(?:;([^/;]+))?$/, 'liveInternet', (_, match) => match[1] || ''],
    [/^st\.top100\.ru$/, /^\/top100\/top100\.js$/, 'rambler'],
    [/^(?:top100|counter)\.rambler\.ru$/, /^\/(?:top100\.cnt|top100\.jcn|cnt\/cnt\.js)$/, 'rambler',
        url => numericId(url.searchParams.get('pid') || url.search.slice(1))],
    [/^cloud(?:-eu)?\.roistat\.com$/, /^\/(?:dist\/module\.js|api\/site\/1\.0\/([\w-]{1,64})\/init)$/, 'roistat', (_, match) => match[1]]
]

const inlineRules = [
    ['metrika', /\bym\s*\(\s*['"]?(\d{1,24})['"]?\s*,\s*['"]init['"]/g],
    ['metrika', /\bnew\s+Ya\.Metrika2?\s*\(\s*(?:\{\s*['"]?id['"]?\s*:\s*)?['"]?(\d{1,24})(?!\d)/g],
    ['ga', /\bga\s*\(\s*['"]create['"]\s*,\s*['"](UA-\d+-\d+)['"]/g],
    ['ga', /\b_gaq\.push\s*\(\s*\[\s*['"]_setAccount['"]\s*,\s*['"](UA-\d+-\d+)['"]/g],
    ['', /\bgtag\s*\(\s*['"]config['"]\s*,\s*['"]([A-Z\d-]+)['"]/g],
    ['meta', /\bfbq\s*\(\s*['"]init['"]\s*,\s*['"]?(\d{1,24})(?!\d)/g],
    ['mailVk', /\b_tmr\.push\s*\(\s*\{[^{}]*?\b['"]?id['"]?\s*:\s*['"]?(\d{1,24})(?!\d)/g],
    ['vk', /\b(?:VK\.Retargeting\.Init|new\s+VK\.Pixel)\s*\(\s*['"](VK-RTRG-\d+-[a-z\d]+)['"]/gi],
    ['roistat', /\}\s*\)\s*\(\s*window\s*,\s*document\s*,\s*['"]script['"]\s*,\s*['"]cloud(?:-eu)?\.roistat\.com['"]\s*,\s*['"]([\w-]{1,64})['"]/g]
]

const urlsIn = /(?<![\w:])(?:https?:)?\/\/[a-z\d][^\s"'`<>\\]*/gi
const scriptType = /^(?:$|module$|text\/plain$|(?:text|application)\/(?:javascript|ecmascript)(?:\s*;|$))/i

export const collectSeoAnalytics = (doc, baseUrl) => {
    const found = new Map()
    const add = (key, id) => {
        if (!key) return
        if (!found.has(key)) found.set(key, new Set())
        if (id) found.get(key).add(id)
    }
    const scanUrl = raw => {
        if (!raw) return
        let url
        try { url = new URL(raw, baseUrl) } catch { return }
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return
        for (const [host, path, key, getId] of urlRules) {
            if (!host.test(url.hostname)) continue
            const match = url.pathname.match(path)
            if (!match) continue
            const id = getId?.(url, match)
            if (key) add(key, id)
            else {
                const product = googleId(id)
                add(product || 'googleTag', product ? id : '')
            }
            break
        }
    }
    const scanScript = text => {
        for (const [key, pattern] of inlineRules) {
            for (const [, id] of text.matchAll(pattern)) add(key || googleId(id), id)
        }
        if (/(?:^|\/\/)(?:www\.)?googletagmanager\.com\/gtm\.js\b/m.test(text)) {
            for (const [, id] of text.matchAll(/['"](GTM-[A-Z\d]+)['"]/g)) add('gtm', id)
        }
        if (/\bnew\s+top100\s*\(/.test(text)) {
            for (const [, id] of text.matchAll(/\b['"]?project['"]?\s*:\s*['"]?(\d{1,24})(?!\d)/g)) add('rambler', id)
        }
    }
    for (const element of doc.querySelectorAll('script, noscript, img[src], img[data-src], iframe[src], iframe[data-src]')) {
        scanUrl(element.getAttribute('src'))
        scanUrl(element.getAttribute('data-src'))
        const script = element.localName === 'script' && scriptType.test(element.type.trim()) && !element.hasAttribute('src')
        if (!script && element.localName !== 'noscript') continue
        const text = element.textContent || ''
        if (script) scanScript(text)
        for (const [url] of text.matchAll(urlsIn)) scanUrl(url.replaceAll('&amp;', '&'))
    }
    // Detached HTML has no browsing context. In a live tab, resource names also
    // reveal tags loaded by other scripts without keeping the request URLs.
    for (const entry of doc.defaultView?.performance.getEntriesByType('resource') || []) scanUrl(entry.name)
    return Object.entries(names).flatMap(([key, name]) => found.has(key) ? [{ key, name, ids: [...found.get(key)] }] : [])
}

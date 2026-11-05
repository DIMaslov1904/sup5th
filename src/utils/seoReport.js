import { collectSeoDom, resolveSeoUrl, seoDocumentBase } from './seoDom.js'
import { collectIndexingRules } from './seoRules.js'
import { AUDIT_DISCOVERY_LIMIT } from './seoAuditDiscovery.js'
import { collectAuditTargets } from './seoAuditLinks.js'
import { collectSeoAnalytics } from './seoAnalytics.js'

export const getSeoMeta = (doc, selector) => doc.querySelector(selector)?.getAttribute('content')?.trim() || ''

// Mixed content: незащищённые ресурсы на HTTPS-странице.
const insecureResourceSelectors = 'img[src], script[src], iframe[src], source[src], video[src], audio[src], embed[src], input[src], link[href], form[action]'
const collectSsl = (doc, url, baseUrl) => {
    const https = url.protocol === 'https:'
    if (!https) return { https: false, mixedContent: 0 }
    const mixedContent = [...doc.querySelectorAll(insecureResourceSelectors)].filter(el => {
        const attribute = el.getAttribute('src') || el.getAttribute('href') || el.getAttribute('action') || ''
        try { return new URL(attribute, baseUrl).protocol === 'http:' } catch { return false }
    }).length
    return { https: true, mixedContent }
}
const declaredCharset = doc => doc.querySelector('meta[charset]')?.getAttribute('charset')?.trim()
    || getSeoMeta(doc, 'meta[http-equiv="Content-Type" i]').match(/charset=([\w-]+)/i)?.[1]?.trim() || ''

export const collectSeoReport = (doc, pageUrl, {
    internalLinkLimit = 50, includeAuditLinks = false, images, source = 'tab'
} = {}) => {
    const url = new URL(pageUrl)
    const base = doc.querySelector('base[href]')
    const live = source === 'tab'
    const baseUrl = live ? doc.baseURI : seoDocumentBase(doc, url.href)
    const dom = collectSeoDom(doc, url.href, { images, baseUrl, live })

    const robotsUrl = new URL('/robots.txt', url.href).href
    const sitemapUrl = new URL('/sitemap.xml', url.href).href
    const indexing = collectIndexingRules(doc)

    const title = doc.title.trim()
    const description = getSeoMeta(doc, 'meta[name="description" i]')
    const h1List = dom.headingRows.filter(row => row.level === 1).map(row => row.text)
    const duplicateH1 = h1List.filter((heading, index) => h1List.indexOf(heading) !== index)
    // Полнота favicon: основной icon, apple-touch-icon, mask-icon и объявления sizes
    const collectFavicon = () => {
        const relTokens = link => [...(link.relList || [])].map(token => token.toLowerCase())
        const links = [...doc.querySelectorAll('link[rel]')]
        const iconLinks = links.filter(link => relTokens(link).includes('icon'))
        return {
            ico: iconLinks.length > 0,
            apple: links.some(link => relTokens(link).some(token => token.startsWith('apple-touch-icon'))),
            mask: links.some(link => relTokens(link).includes('mask-icon')),
            sizes: iconLinks.map(link => link.getAttribute('sizes') || '').filter(Boolean)
        }
    }

    // Уникальные внутренние ссылки (для расширенного аудита на отдельной странице)
    const currentUrl = new URL(url); currentUrl.hash = ''
    const internalLinkUrls = [...new Set([...doc.links].filter(link => !link.hasAttribute('data-sup-seo-download')).map(link => {
        try {
            const url = new URL(link.getAttribute('href'), baseUrl); url.hash = ''
            return /^https?:$/.test(url.protocol) && url.origin === currentUrl.origin && !url.username && !url.password && url.href !== currentUrl.href ? url.href : ''
        } catch { return '' }
    }).filter(Boolean))]
    const linkLimit = Number.isFinite(Number(internalLinkLimit)) ? Math.max(0, Math.min(AUDIT_DISCOVERY_LIMIT - 1, Math.trunc(Number(internalLinkLimit)))) : 50
    const internalLinks = internalLinkUrls.slice(0, linkLimit)
    const auditLinks = includeAuditLinks ? collectAuditTargets(doc, url.href) : []

    return {
        ...dom,
        source,
        url: url.href,
        baseUrl,
        baseDeclared: Boolean(base),
        baseDisplay: base ? baseUrl : new URL('/', url).href,
        scannedAt: Date.now(),
        finalUrl: url.href,
        redirected: false,
        title,
        description,
        keywords: getSeoMeta(doc, 'meta[name="keywords" i]'),
        canonical: dom.canonicals[0]?.href || '',
        ...indexing,
        xRobotsAllowed: null,
        lang: doc.documentElement.lang || '',
        viewport: Boolean(getSeoMeta(doc, 'meta[name="viewport" i]')),
        h1Count: h1List.length,
        duplicateH1,
        twitter: {
            card: getSeoMeta(doc, 'meta[name="twitter:card" i]'),
            title: getSeoMeta(doc, 'meta[name="twitter:title" i]'),
            description: getSeoMeta(doc, 'meta[name="twitter:description" i]'),
            image: getSeoMeta(doc, 'meta[name="twitter:image" i]')
        },
        charset: {
            meta: declaredCharset(doc),
            document: live ? doc.characterSet || '' : ''
        },
        ssl: collectSsl(doc, url, baseUrl),
        hreflang: [...doc.querySelectorAll('link[rel="alternate"][hreflang]')].map((link) => ({
            hreflang: link.hreflang,
            href: resolveSeoUrl(link.getAttribute('href'), baseUrl)
        })),
        response: { pending: true, status: 0, ok: false, ttfb: null },
        internalLinks,
        internalLinksTotal: internalLinkUrls.length,
        ...(includeAuditLinks ? { auditLinks: auditLinks.slice(0, AUDIT_DISCOVERY_LIMIT), auditLinksTotal: auditLinks.length } : {}),
        robotsFile: {
            url: robotsUrl,
            exists: false, status: 0, content: '', allowed: null, pending: true
        },
        sitemap: {
            url: sitemapUrl,
            exists: false, status: 0, pending: true
        },
        llmTxt: {
            url: new URL('/llm.txt', url.href).href,
            exists: false, status: 0, size: null, pending: true
        },
        favicon: collectFavicon(),
        analytics: collectSeoAnalytics(doc, baseUrl),
        images: {
            total: dom.imageRows.length,
            withoutAlt: dom.imageRows.filter((image) => image.alt === null).length,
            emptyAlt: dom.imageRows.filter((image) => image.alt !== null && !image.alt.trim()).length
        }
    }
}


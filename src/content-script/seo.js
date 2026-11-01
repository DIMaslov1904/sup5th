import { extensionApi } from '../platform/extensionApi.js'
import { collectSeoDom } from '../utils/seoDom.js'
import { collectIndexingRules } from '../utils/seoRules.js'
import { loadSeoNetwork } from '../utils/seoNetwork.js'
import { getSeoActions, setSeoAction } from './seoActions.js'
import { captureHeadings, focusHeading } from './headingNavigation.js'
import { collectPageWeight } from './pageWeight.js'
import { collectCwv, waitForCwv } from '../utils/cwv.js'
import { AUDIT_DISCOVERY_LIMIT } from '../utils/seoAuditDiscovery.js'
import { collectAuditTargets } from '../utils/seoAuditLinks.js'
const documentId = [...crypto.getRandomValues(new Uint32Array(4))].join('-')
/**
 * SEO-анализ текущей страницы.
 * Выполняется в контексте content script (доступ к DOM).
 * Сетевые запросы (robots.txt, sitemap, проверка ссылок) выполняются в
 * фоновом процессе через сообщение 'seo:fetch' — это обходит CSP страницы
 * и не нагружает вкладку.
 * Внедряется в страницу как IIFE из utils/seoClient.js; обработчики сообщений — ниже.
 */

const getMeta = (selector) => document.querySelector(selector)?.getAttribute('content')?.trim() || ''


// Запрос выполняется в background (нет ограничений CSP страницы)
const fetchViaBackground = async (url, options = {}) => {
    const failed = { ok: false, status: 0, url: '', headers: {}, text: '', ttfb: null }
    try {
        const response = await extensionApi.runtime.sendMessage({ type: 'seo:fetch', payload: { url, ...options, method: options.method || 'GET' } })
        if (!response?.ok) return failed
        const data = response.data || {}
        return { ...failed, ...data }
    } catch { return failed }
}

// Mixed content: незащищённые ресурсы на HTTPS-странице.
const insecureResourceSelectors = 'img[src], script[src], iframe[src], source[src], video[src], audio[src], embed[src], input[src], link[href], form[action]'
const collectSsl = () => {
    const https = location.protocol === 'https:'
    if (!https) return { https: false, mixedContent: 0 }
    const mixedContent = [...document.querySelectorAll(insecureResourceSelectors)].filter(el => {
        const attribute = el.getAttribute('src') || el.getAttribute('href') || el.getAttribute('action') || ''
        try { return new URL(attribute, document.baseURI).protocol === 'http:' } catch { return false }
    }).length
    return { https: true, mixedContent }
}
const declaredCharset = () => document.querySelector('meta[charset]')?.getAttribute('charset')?.trim()
    || getMeta('meta[http-equiv="Content-Type" i]').match(/charset=([\w-]+)/i)?.[1]?.trim() || ''

export const collectSeoReport = ({ internalLinkLimit = 50, includeAuditLinks = false } = {}) => {
    const dom = collectSeoDom(document, location.href)

    const robotsUrl = new URL('/robots.txt', location.href).href
    const sitemapUrl = new URL('/sitemap.xml', location.href).href
    const indexing = collectIndexingRules(document)

    const title = document.title.trim()
    const description = getMeta('meta[name="description" i]')
    const h1List = dom.headingRows.filter(row => row.level === 1).map(row => row.text)
    const duplicateH1 = h1List.filter((heading, index) => h1List.indexOf(heading) !== index)
    // Полнота favicon: основной icon, apple-touch-icon, mask-icon и объявления sizes
    const collectFavicon = () => {
        const relTokens = link => [...(link.relList || [])].map(token => token.toLowerCase())
        const links = [...document.querySelectorAll('link[rel]')]
        const iconLinks = links.filter(link => relTokens(link).includes('icon'))
        return {
            ico: iconLinks.length > 0,
            apple: links.some(link => relTokens(link).some(token => token.startsWith('apple-touch-icon'))),
            mask: links.some(link => relTokens(link).includes('mask-icon')),
            sizes: iconLinks.map(link => link.getAttribute('sizes') || '').filter(Boolean)
        }
    }

    // Уникальные внутренние ссылки (для расширенного аудита на отдельной странице)
    const currentUrl = new URL(location.href); currentUrl.hash = ''
    const internalLinkUrls = [...new Set([...document.links].map(link => {
        try {
            const url = new URL(link.href); url.hash = ''
            return /^https?:$/.test(url.protocol) && url.origin === location.origin && !url.username && !url.password && url.href !== currentUrl.href ? url.href : ''
        } catch { return '' }
    }).filter(Boolean))]
    const linkLimit = Number.isFinite(Number(internalLinkLimit)) ? Math.max(0, Math.min(AUDIT_DISCOVERY_LIMIT - 1, Math.trunc(Number(internalLinkLimit)))) : 50
    const internalLinks = internalLinkUrls.slice(0, linkLimit)
    const auditLinks = includeAuditLinks ? collectAuditTargets(document, location.href) : []

    captureHeadings()
    return {
        ...dom,
        documentId,
        actions: getSeoActions(),
        url: location.href,
        baseUrl: document.baseURI,
        baseDeclared: Boolean(document.querySelector('base[href]')),
        baseDisplay: document.querySelector('base[href]')?.href || new URL('/', location.href).href,
        scannedAt: Date.now(),
        finalUrl: location.href,
        redirected: false,
        title,
        description,
        keywords: getMeta('meta[name="keywords" i]'),
        canonical: document.querySelector('link[rel~="canonical" i]')?.href || '',
        ...indexing,
        xRobotsAllowed: null,
        lang: document.documentElement.lang || '',
        viewport: Boolean(getMeta('meta[name="viewport" i]')),
        h1Count: h1List.length,
        duplicateH1,
        twitter: {
            card: getMeta('meta[name="twitter:card" i]'),
            title: getMeta('meta[name="twitter:title" i]'),
            description: getMeta('meta[name="twitter:description" i]'),
            image: getMeta('meta[name="twitter:image" i]')
        },
        charset: {
            meta: declaredCharset(),
            document: document.characterSet || ''
        },
        ssl: collectSsl(),
        hreflang: [...document.querySelectorAll('link[rel="alternate"][hreflang]')].map((link) => ({
            hreflang: link.hreflang,
            href: link.href
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
            url: new URL('/llm.txt', location.href).href,
            exists: false, status: 0, size: null, pending: true
        },
        favicon: collectFavicon(),
        images: {
            total: dom.imageRows.length,
            withoutAlt: dom.imageRows.filter((image) => image.alt === null).length,
            emptyAlt: dom.imageRows.filter((image) => image.alt !== null && !image.alt.trim()).length
        },
        pageWeight: collectPageWeight(document),
        cwv: collectCwv()
    }
}

export const scanSeo = async () => {
    await waitForCwv()
    return loadSeoNetwork(collectSeoReport(), (url, method, options) => fetchViaBackground(url, { method, ...options }))
}

/** Регистрирует обработчик сообщений 'seo:scan' */
const registerSeoHandler = () => {
    extensionApi.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (message?.type === 'seo:context') {
            sendResponse({ ok: true, data: { documentId, url: location.href, actions: getSeoActions() } })
            return false
        }
        if (message?.type === 'seo:heading') {
            try { sendResponse({ ok: true, data: focusHeading(message.payload || {}) }) }
            catch (error) { sendResponse({ ok: false, error: error.message }) }
            return false
        }
        if (message?.type === 'seo:action') {
            try { sendResponse({ ok: true, data: setSeoAction(message.payload) }) }
            catch (error) { sendResponse({ ok: false, error: error.message }) }
            return false
        }
        if (message?.type === 'seo:dom') {
            ;(async () => {
                try {
                    await waitForCwv()
                    sendResponse({ ok: true, data: collectSeoReport(message.payload || {}) })
                } catch (error) { sendResponse({ ok: false, error: error.message }) }
            })()
            return true
        }
        if (message?.type === 'seo:cwv') {
            ;(async () => {
                try {
                    await waitForCwv()
                    sendResponse({ ok: true, data: collectCwv() })
                } catch (error) { sendResponse({ ok: false, error: error.message }) }
            })()
            return true
        }
        if (message?.type !== 'seo:scan') return false
        scanSeo()
            .then((data) => sendResponse({ ok: true, data }))
            .catch((error) => sendResponse({ ok: false, error: error.message }))
        return true
    })
}

if (!globalThis.__sup5thSeoRegistered) {
    globalThis.__sup5thSeoRegistered = true
    registerSeoHandler()
}

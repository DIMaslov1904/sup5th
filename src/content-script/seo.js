import { extensionApi } from '../platform/extensionApi.js'
import { collectSeoDom } from '../utils/seoDom.js'
import { collectIndexingRules } from '../utils/seoRules.js'
import { loadSeoNetwork } from '../utils/seoNetwork.js'
import { getSeoActions, setSeoAction } from './seoActions.js'
import { captureHeadings, focusHeading } from './headingNavigation.js'
import { collectPageWeight } from './pageWeight.js'
const documentId = [...crypto.getRandomValues(new Uint32Array(4))].join('-')
/**
 * SEO-анализ текущей страницы.
 * Выполняется в контексте content script (доступ к DOM).
 * Сетевые запросы (robots.txt, sitemap, проверка ссылок) выполняются в
 * фоновом процессе через сообщение 'seo:fetch' — это обходит CSP страницы
 * и не нагружает вкладку.
 * Зарегистрирован через registerSeoHandler() в index.js.
 */

const getMeta = (selector) => document.querySelector(selector)?.getAttribute('content')?.trim() || ''

const getHeadings = (level) => [...document.querySelectorAll(`h${level}`)]
    .map((element) => element.textContent.trim())

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

const hasCyrillic = (value) => /[а-яё]/i.test(value)

export const collectSeoReport = ({ internalLinkLimit = 50 } = {}) => {
    const dom = collectSeoDom(document, location.href)
    const headings = Object.fromEntries([1, 2, 3, 4, 5, 6].map((level) => [`h${level}`, getHeadings(level)]))
    const robotsUrl = new URL('/robots.txt', location.href).href
    const pageInfo = { url: location.href, status: 0, ok: false, ttfb: null }
    const sitemapUrl = new URL('/sitemap.xml', location.href).href
    const xRobots = ''
    const indexing = collectIndexingRules(document, xRobots)

    const title = document.title.trim()
    const description = getMeta('meta[name="description" i]')
    const h1List = headings.h1
    const duplicateH1 = h1List.filter((heading, index) => h1List.indexOf(heading) !== index)
    const faviconLink = document.querySelector('link[rel~="icon"]')?.href || ''

    // Уникальные внутренние ссылки (для расширенного аудита на отдельной странице)
    const currentUrl = new URL(location.href); currentUrl.hash = ''
    const internalLinkUrls = [...new Set([...document.links].map(link => {
        try {
            const url = new URL(link.href); url.hash = ''
            return /^https?:$/.test(url.protocol) && url.origin === location.origin && !url.username && !url.password && url.href !== currentUrl.href ? url.href : ''
        } catch { return '' }
    }).filter(Boolean))]
    const linkLimit = Number.isFinite(Number(internalLinkLimit)) ? Math.max(0, Math.min(499, Math.trunc(Number(internalLinkLimit)))) : 50
    const internalLinks = internalLinkUrls.slice(0, linkLimit)

    captureHeadings()
    return {
        ...dom,
        documentId,
        indexingMeta: [...document.querySelectorAll('meta[name]')].map(el => ({ name: el.name, content: el.content })),
        actions: getSeoActions(),
        url: location.href,
        baseUrl: document.baseURI,
        baseDeclared: Boolean(document.querySelector('base[href]')),
        baseDisplay: document.querySelector('base[href]')?.href || new URL('/', location.href).href,
        scannedAt: Date.now(),
        urlLength: location.href.length,
        finalUrl: pageInfo.url || location.href,
        redirected: Boolean(pageInfo.url && pageInfo.url !== location.href),
        title,
        titleLength: title.length,
        titleHasCyrillic: hasCyrillic(title),
        description,
        descriptionLength: description.length,
        descriptionHasCyrillic: hasCyrillic(description),
        keywords: getMeta('meta[name="keywords" i]'),
        canonical: document.querySelector('link[rel~="canonical" i]')?.href || '',
        ...indexing,
        xRobots,
        xRobotsAllowed: pageInfo.status ? indexing.xRobotsAllowed : null,
        lang: document.documentElement.lang || '',
        viewport: Boolean(getMeta('meta[name="viewport" i]')),
        headings,
        h1Count: h1List.length,
        duplicateH1,
        openGraph: {
            title: getMeta('meta[property="og:title"]'),
            description: getMeta('meta[property="og:description"]'),
            image: getMeta('meta[property="og:image"]'),
            type: getMeta('meta[property="og:type"]'),
            url: getMeta('meta[property="og:url"]')
        },
        jsonLdBlocks: document.querySelectorAll('script[type="application/ld+json"]').length,
        hreflang: [...document.querySelectorAll('link[rel="alternate"][hreflang]')].map((link) => ({
            hreflang: link.hreflang,
            href: link.href
        })),
        response: {
            pending: true,
            status: pageInfo.status,
            ok: pageInfo.ok,
            ttfb: pageInfo.ttfb ?? null
        },
        internalLinks,
        internalLinksTotal: internalLinkUrls.length,
        robotsFile: {
            url: robotsUrl,
            exists: false, status: 0, content: '', allowed: null, pending: true
        },
        sitemap: {
            url: sitemapUrl,
            exists: false, status: 0, pending: true
        },
        favicon: faviconLink,
        images: {
            total: document.images.length,
            withoutAlt: [...document.images].filter((image) => !image.hasAttribute('alt')).length,
            emptyAlt: [...document.images].filter((image) => image.hasAttribute('alt') && !image.alt.trim()).length
        },
        links: {
            total: document.links.length,
            internal: [...document.links].filter((link) => link.hostname === location.hostname).length,
            external: [...document.links].filter((link) => link.hostname && link.hostname !== location.hostname).length,
            withoutText: dom.linkRows.filter(link => !link.accessibleName).length
        },
        wordCount: (document.body?.innerText || '').trim().split(/\s+/).filter(Boolean).length,
        htmlSize: document.documentElement.outerHTML.length,
        pageWeight: collectPageWeight(document)
    }
}
export const scanSeo = () => loadSeoNetwork(collectSeoReport(), (url, method, options) => fetchViaBackground(url, { method, ...options }))

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
            try { sendResponse({ ok: true, data: collectSeoReport(message.payload || {}) }) }
            catch (error) { sendResponse({ ok: false, error: error.message }) }
            return false
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

import { collectSeoDom } from '../utils/seoDom.js'
import { evaluateRobotsFile, collectIndexingRules } from '../utils/seoRules.js'
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
    .filter(Boolean)

// Запрос выполняется в background (нет ограничений CSP страницы)
const fetchViaBackground = (url, options = {}) => new Promise((resolve) => {
    chrome.runtime.sendMessage(
        { type: 'seo:fetch', payload: { url, method: options.method || 'GET' } },
        (response) => {
            const error = chrome.runtime.lastError
            if (error || !response?.ok) {
                resolve({ ok: false, status: 0, url: '', headers: {}, text: '', ttfb: null })
                return
            }
            const data = response.data || {}
            resolve({
                ok: Boolean(data.ok),
                status: data.status || 0,
                url: data.url || '',
                headers: data.headers || {},
                text: data.text || '',
                ttfb: data.ttfb ?? null
            })
        }
    )
})

const fetchPageInfo = fetchViaBackground

const hasCyrillic = (value) => /[а-яё]/i.test(value)

export const scanSeo = async () => {
    const headings = Object.fromEntries([1, 2, 3, 4, 5, 6].map((level) => [`h${level}`, getHeadings(level)]))
    const robotsUrl = new URL('/robots.txt', location.href).href
    const [pageInfo, robotsInfo] = await Promise.all([
        fetchPageInfo(location.href, { method: 'HEAD' }).then(info => info.ok ? info : fetchPageInfo(location.href)),
        fetchPageInfo(robotsUrl)
    ])
    const sitemapFromRobots = robotsInfo.text.match(/^\s*Sitemap:\s*(\S+)/im)?.[1]
    const sitemapUrl = sitemapFromRobots || new URL('/sitemap.xml', location.href).href
    let sitemapInfo = await fetchPageInfo(sitemapUrl, { method: 'HEAD' })
    if (!sitemapInfo.ok) sitemapInfo = await fetchPageInfo(sitemapUrl)
    const xRobots = pageInfo.headers['x-robots-tag'] || ''
    const indexing = collectIndexingRules(document, xRobots)

    const title = document.title.trim()
    const description = getMeta('meta[name="description"]')
    const h1List = headings.h1
    const duplicateH1 = h1List.filter((heading, index) => h1List.indexOf(heading) !== index)
    const faviconLink = document.querySelector('link[rel~="icon"]')?.href || ''

    // Уникальные внутренние ссылки (для расширенного аудита на отдельной странице)
    const allLinks = [...document.links].map((link) => link.href).filter((href) => /^https?:/.test(href))
    const internalLinks = [...new Set(allLinks.filter((href) => {
        try {
            return new URL(href).hostname === location.hostname
        } catch {
            return false
        }
    }))].slice(0, 50)

    captureHeadings()
    return {
        ...collectSeoDom(document, location.href),
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
        keywords: getMeta('meta[name="keywords"]'),
        canonical: document.querySelector('link[rel="canonical"]')?.href || '',
        ...indexing,
        xRobots,
        xRobotsAllowed: pageInfo.status ? indexing.xRobotsAllowed : null,
        lang: document.documentElement.lang || '',
        viewport: Boolean(getMeta('meta[name="viewport"]')),
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
            status: pageInfo.status,
            ok: pageInfo.ok,
            ttfb: pageInfo.ttfb ?? null
        },
        internalLinks,
        robotsFile: {
            url: robotsUrl,
            exists: robotsInfo.ok,
            status: robotsInfo.status,
            content: robotsInfo.text,
            allowed: evaluateRobotsFile({ exists: robotsInfo.ok, status: robotsInfo.status, content: robotsInfo.text }, location.href).allowed
        },
        sitemap: {
            url: sitemapUrl,
            exists: sitemapInfo.ok,
            status: sitemapInfo.status
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
            withoutText: [...document.links].filter((link) => !link.textContent.trim() && !link.querySelector('img[alt]')).length
        },
        wordCount: (document.body?.innerText || '').trim().split(/\s+/).filter(Boolean).length,
        htmlSize: document.documentElement.outerHTML.length,
        pageWeight: collectPageWeight(document)
    }
}

/** Регистрирует обработчик сообщений 'seo:scan' */
const registerSeoHandler = () => {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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

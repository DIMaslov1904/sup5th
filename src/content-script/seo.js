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
    let pageInfo = await fetchPageInfo(location.href, { method: 'HEAD' })
    if (!pageInfo.ok) pageInfo = await fetchPageInfo(location.href)
    const robotsUrl = new URL('/robots.txt', location.href).href
    const robotsInfo = await fetchPageInfo(robotsUrl)
    const sitemapFromRobots = robotsInfo.text.match(/^\s*Sitemap:\s*(\S+)/im)?.[1]
    const sitemapUrl = sitemapFromRobots || new URL('/sitemap.xml', location.href).href
    let sitemapInfo = await fetchPageInfo(sitemapUrl, { method: 'HEAD' })
    if (!sitemapInfo.ok) sitemapInfo = await fetchPageInfo(sitemapUrl)
    const robots = getMeta('meta[name="robots"]')
    const xRobots = pageInfo.headers['x-robots-tag'] || ''

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

    return {
        url: location.href,
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
        generator: getMeta('meta[name="generator"]'),
        canonical: document.querySelector('link[rel="canonical"]')?.href || '',
        robots,
        robotsAllowed: !/(noindex|none)/i.test(robots),
        xRobots,
        xRobotsAllowed: !/(noindex|none)/i.test(xRobots),
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
        twitterCard: getMeta('meta[name="twitter:card"]'),
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
            content: robotsInfo.text.slice(0, 4000),
            allowed: !/(Disallow:\s*\/\s*$)/im.test(robotsInfo.text)
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
        htmlSize: document.documentElement.outerHTML.length
    }
}

/** Регистрирует обработчик сообщений 'seo:scan' */
const registerSeoHandler = () => {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (message?.type !== 'seo:scan') return false
        scanSeo()
            .then((data) => sendResponse({ ok: true, data }))
            .catch((error) => sendResponse({ ok: false, error: error.message }))
        return true
    })
}

registerSeoHandler()

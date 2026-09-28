/**
 * SEO-анализ текущей страницы.
 * Выполняется в контексте content script (доступ к DOM и fetch с credentials).
 * Зарегистрирован через registerSeoHandler() в index.js.
 */

const getMeta = (selector) => document.querySelector(selector)?.getAttribute('content')?.trim() || ''

const getHeadings = (level) => [...document.querySelectorAll(`h${level}`)]
    .map((element) => element.textContent.trim())
    .filter(Boolean)

const fetchPageInfo = async (url, options = {}) => {
    try {
        const response = await fetch(url, { ...options, credentials: 'include' })
        return {
            ok: response.ok,
            status: response.status,
            url: response.url,
            headers: Object.fromEntries(response.headers.entries()),
            text: await response.text()
        }
    } catch {
        return { ok: false, status: 0, url: '', headers: {}, text: '' }
    }
}

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
            ok: pageInfo.ok
        },
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
export const registerSeoHandler = () => {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (message?.type !== 'seo:scan') return false
        scanSeo()
            .then((data) => sendResponse({ ok: true, data }))
            .catch((error) => sendResponse({ ok: false, error: error.message }))
        return true
    })
}

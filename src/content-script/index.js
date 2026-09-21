const AUTH_KEY = 'pendingAdminAuth'
const AUTH_TTL = 5 * 60 * 1000

const setInputValue = (input, value) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
}

const findInput = (selectors) => selectors
    .map((selector) => document.querySelector(selector))
    .find((input) => input instanceof HTMLInputElement)

const fillAdminForm = (auth) => {
    if (Date.now() - auth.createdAt > AUTH_TTL) return false

    const login = findInput([
        '[name="USER_LOGIN"]',
        '[name="username"]',
        '[name="email"]',
        '[name="login"]',
        'input[type="email"]',
        'input[autocomplete="username"]'
    ])
    const password = findInput([
        '[name="USER_PASSWORD"]',
        '[name="password"]',
        'input[type="password"]',
        'input[autocomplete="current-password"]'
    ])
    if (!login || !password) return false

    setInputValue(login, auth.login)
    setInputValue(password, auth.password)

    if (auth.cms !== 'Tilda') {
        const submit = document.querySelector('[name="Login"], [name="login"], #send, button[type="submit"], input[type="submit"]')
        if (submit instanceof HTMLElement) submit.click()
    }
    return true
}

const startAdminAuth = async () => {
    const result = await chrome.storage.local.get([AUTH_KEY])
    const auth = result[AUTH_KEY]
    if (!auth || Date.now() - auth.createdAt > AUTH_TTL) {
        if (auth) await chrome.storage.local.remove(AUTH_KEY)
        return
    }

    if (location.origin !== auth.targetOrigin || !auth.targetPaths?.some((path) => location.pathname.startsWith(path))) return

    if (fillAdminForm(auth)) {
        await chrome.storage.local.remove(AUTH_KEY)
        return
    }

    const observer = new MutationObserver(async () => {
        if (!document.body || !fillAdminForm(auth)) return
        observer.disconnect()
        await chrome.storage.local.remove(AUTH_KEY)
    })
    observer.observe(document.documentElement, { childList: true, subtree: true })
    setTimeout(() => observer.disconnect(), 15000)
}

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
            headers: Object.fromEntries(response.headers.entries()),
            text: await response.text()
        }
    } catch {
        return { ok: false, status: 0, headers: {}, text: '' }
    }
}

const scanSeo = async () => {
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

    return {
        url: location.href,
        urlLength: location.href.length,
        title: document.title.trim(),
        titleLength: document.title.trim().length,
        description: getMeta('meta[name="description"]'),
        descriptionLength: getMeta('meta[name="description"]').length,
        keywords: getMeta('meta[name="keywords"]'),
        canonical: document.querySelector('link[rel="canonical"]')?.href || '',
        robots,
        robotsAllowed: !/(noindex|none)/i.test(robots),
        xRobots,
        xRobotsAllowed: !/(noindex|none)/i.test(xRobots),
        lang: document.documentElement.lang || '',
        viewport: getMeta('meta[name="viewport"]'),
        headings,
        openGraph: {
            title: getMeta('meta[property="og:title"]'),
            description: getMeta('meta[property="og:description"]'),
            image: getMeta('meta[property="og:image"]'),
            type: getMeta('meta[property="og:type"]')
        },
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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'seo:scan') return false
    scanSeo()
        .then((data) => sendResponse({ ok: true, data }))
        .catch((error) => sendResponse({ ok: false, error: error.message }))
    return true
})

startAdminAuth().catch((error) => console.error('[content] admin auth', error))

const privateHeader = /^(?:set-cookie2?|cookie|authorization|proxy-authorization|www-authenticate|proxy-authenticate|.*(?:token|secret|api-key).*)$/i
export const seoResponseHeaders = headers => {
    const safe = {}
    for (const [name, value] of Array.isArray(headers) ? headers.map(({ name, value }) => [name, value || '']) : Object.entries(headers || {})) {
        if (privateHeader.test(name)) continue
        const key = name.toLowerCase()
        safe[key] = Object.hasOwn(safe, key) ? `${safe[key]}, ${value}` : value
    }
    return safe
}

// Listeners exist only for this fetch. requestId follows redirects across origins.
export const observeSeoRequest = ({ webRequest, extensionUrl, url, method }) => {
    const listeners = [], chain = []
    let requestId = null, ambiguous = false, ip = ''
    const source = value => { try { const parsed = new URL(value); parsed.hash = ''; return parsed.href } catch { return '' } }
    const initialUrl = source(url), extensionOrigin = extensionUrl.replace(/\/$/, '')
    const startsHere = details => {
        const initiator = details.initiator || details.originUrl || ''
        return (initiator === extensionOrigin || initiator.startsWith(extensionOrigin + '/')) && details.method === method && source(details.url) === initialUrl
    }
    const before = details => {
        if (!startsHere(details)) return
        if (requestId && requestId !== details.requestId) ambiguous = true
        requestId ||= details.requestId
    }
    const record = details => {
        if (details.requestId !== requestId) return
        if (details.ip) ip = details.ip
        const previous = chain.at(-1)
        const prior = previous?.url === details.url && !previous.redirectUrl ? previous : null
        const headers = details.responseHeaders
        const hop = { url: details.url, status: details.statusCode, headers: headers ? seoResponseHeaders(headers) : prior?.headers || {}, xRobotsTags: headers ? headers.filter(item => item.name.toLowerCase() === 'x-robots-tag').map(item => item.value || '') : prior?.xRobotsTags, ip: details.ip || '', ...(details.redirectUrl ? { redirectUrl: details.redirectUrl } : {}) }
        if (previous?.url === hop.url && !previous.redirectUrl) chain[chain.length - 1] = hop
        else chain.push(hop)
    }
    const dispose = () => { for (const [event, callback] of listeners.splice(0)) event.removeListener(callback) }
    const listen = (event, callback, extra = []) => {
        event.addListener(callback, { urls: ['http://*/*', 'https://*/*'], types: ['xmlhttprequest', 'other'] }, extra)
        listeners.push([event, callback])
    }
    try {
        listen(webRequest.onBeforeRequest, before)
        listen(webRequest.onBeforeRedirect, record, ['responseHeaders'])
        listen(webRequest.onResponseStarted, record, ['responseHeaders'])
        listen(webRequest.onCompleted, record, ['responseHeaders'])
    } catch { dispose() }
    return {
        dispose,
        result: response => {
            if (ambiguous) return { ip: '', chain: [], traceComplete: false }
            const last = chain.at(-1)
            const traceComplete = Boolean(last && !last.redirectUrl && source(last.url) === source(response.url) && last.status === response.status)
            return { ip, chain: [...chain], traceComplete, ...(traceComplete && last.xRobotsTags ? { xRobotsTags: last.xRobotsTags } : {}) }
        }
    }
}

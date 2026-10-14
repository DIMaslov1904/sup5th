const addresses = new Map()
const rememberAddress = details => {
    if (!details.ip) return
    try {
        addresses.set(new URL(details.url).origin, { address: details.ip, updatedAt: Date.now() })
        if (addresses.size > 200) addresses.delete(addresses.keys().next().value)
    } catch { /* Ignore non-HTTP resources. */ }
}
const filter = { urls: ['http://*/*', 'https://*/*'], types: ['main_frame', 'xmlhttprequest', 'other'] }
chrome.webRequest.onResponseStarted.addListener(rememberAddress, filter)
chrome.webRequest.onCompleted.addListener(rememberAddress, filter)

export const getServerAddress = async ({ url }) => {
    let parsed
    try { parsed = new URL(url) } catch { return { address: '' } }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return { address: '' }
    const cached = addresses.get(parsed.origin)
    if (cached && Date.now() - cached.updatedAt < 10 * 60 * 1000) return { address: cached.address }
    try {
        const response = await fetch(parsed.href, { method: 'HEAD', credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(10000) })
        await response.body?.cancel()
        // HEAD completion and its webRequest event can arrive in adjacent tasks.
        await new Promise(resolve => setTimeout(resolve, 50))
        return { address: addresses.get(new URL(response.url || parsed.href).origin)?.address || '' }
    } catch { return { address: '' } }
}

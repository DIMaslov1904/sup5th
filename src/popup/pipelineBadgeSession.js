import { parseSiteAddress } from '../utils/siteAddress.js'

export const getPipelineLinks = repository => {
    if (!String(repository || '').trim()) return null
    try {
        const url = parseSiteAddress(repository)
        const path = url.pathname.replace(/\/+$/, '').replace(/\.git$/, '')
        if (!path) return null
        const base = url.origin + path
        return { badgeUrl: `${base}/badges/main/pipeline.svg`, commitsUrl: `${base}/-/commits/main` }
    } catch { return null }
}

// Lives in the popup document, never in storage or the background worker.
export const createPipelineBadgeSession = (fetchBadge = fetch, isEnabled = () => true) => {
    const cache = new Map()
    let authRequired = false
    let queue = Promise.resolve()
    const request = async url => {
        if (authRequired || !isEnabled()) { cache.delete(url); return null }
        try {
            const response = await fetchBadge(url, {
                credentials: 'include', redirect: 'follow', cache: 'no-store',
                signal: AbortSignal.timeout(10000)
            })
            const type = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
            const loginRedirect = response.redirected && /\/(?:sign_in|sign-in|login|oauth|saml)(?:\/|$)/i.test(new URL(response.url).pathname)
            if (response.status === 401 || loginRedirect || (response.ok && ['text/html', 'application/xhtml+xml'].includes(type))) {
                authRequired = true
                return null
            }
            if (!response.ok || type !== 'image/svg+xml') return null
            return await response.blob()
        } catch { return null }
    }
    const load = repository => {
        const links = getPipelineLinks(repository)
        if (!isEnabled() || authRequired || !links) return Promise.resolve(null)
        if (!cache.has(links.badgeUrl)) {
            const result = queue.then(() => request(links.badgeUrl))
            cache.set(links.badgeUrl, result)
            // A queued project must wait until the preceding auth check finishes.
            queue = result.then(() => undefined)
        }
        return cache.get(links.badgeUrl)
    }
    return { load }
}


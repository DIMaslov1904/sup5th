import { getPipelineLinks } from '../utils/pipelineLinks.js'
export { getPipelineLinks } from '../utils/pipelineLinks.js'

// SVGs and auth suppression stay in this document. Only confirmed absence is persisted.
export const createPipelineBadgeSession = (fetchBadge = fetch, isEnabled = () => true, missing = { get: async () => false, set: async () => {} }) => {
    const cache = new Map()
    let authRequired = false
    let queue = Promise.resolve()
    const request = async url => {
        if (!isEnabled()) return { state: 'disabled' }
        if (authRequired) return { state: 'auth' }
        try {
            const response = await fetchBadge(url, {
                credentials: 'include', redirect: 'follow', cache: 'no-store',
                signal: AbortSignal.timeout(10000)
            })
            const type = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
            const loginRedirect = response.redirected && /\/(?:sign_in|sign-in|login|oauth|saml)(?:\/|$)/i.test(new URL(response.url).pathname)
            if ([401, 403].includes(response.status) || loginRedirect || (response.ok && ['text/html', 'application/xhtml+xml'].includes(type))) {
                authRequired = true
                return { state: 'auth' }
            }
            if ([404, 410].includes(response.status)) return { state: 'missing' }
            if (!response.ok || type !== 'image/svg+xml') return { state: 'unknown' }
            const svg = await response.text()
            if (!/<svg\b/i.test(svg)) return { state: 'unknown' }
            if (/(?:pipeline|build):\s*(?:unknown|not found|none)\b/i.test(svg) || /<text\b[^>]*>\s*(?:unknown|not found)\s*<\/text>/i.test(svg)) return { state: 'missing' }
            return { state: 'ready', blob: new Blob([svg], { type: 'image/svg+xml' }) }
        } catch { return { state: 'unknown' } }
    }
    const discover = async (links, force) => {
        if (!isEnabled()) return { state: 'disabled' }
        if (authRequired) return { state: 'auth' }
        if (force) await missing.set(links.repository, false)
        else if (await missing.get(links.repository)) return { state: 'missing' }
        const main = await request(links.badgeUrl)
        if (main.state === 'ready') return { ...main, branch: 'main', links }
        if (main.state !== 'missing') return main
        const fallback = getPipelineLinks(links.repository, 'master'), master = await request(fallback.badgeUrl)
        if (master.state === 'ready') return { ...master, branch: 'master', links: fallback }
        if (master.state === 'missing') await missing.set(links.repository, true)
        return master
    }
    const load = (repository, { force = false } = {}) => {
        const links = getPipelineLinks(repository)
        if (!isEnabled()) return Promise.resolve({ state: 'disabled' })
        if (authRequired || !links) return Promise.resolve({ state: authRequired ? 'auth' : 'invalid' })
        if (force || !cache.has(links.repository)) {
            const result = queue.then(() => discover(links, force)).catch(() => ({ state: 'unknown' }))
            cache.set(links.repository, result)
            // A queued project must wait until the preceding auth check finishes.
            queue = result.then(() => undefined)
        }
        return cache.get(links.repository)
    }
    return { load }
}


import { normalizeAuditUrl } from './seoAuditLinks.js'
import { AUDIT_HTML_LIMIT } from './seoAuditPages.js'
const empty = url => ({ ok: false, status: 0, url, headers: {}, text: '', ttfb: null })

export const createAuditFetch = (fetchResource, { signal, waitForResume, exclusions, excludeNonIndexable }) => async (
    url, maxBytes = AUDIT_HTML_LIMIT, trace = false, htmlOnly = false, guard = false
) => {
    let current = url, elapsed = 0, timingKnown = true
    const chain = [], visited = new Set()
    for (let hop = 0; hop <= 10; hop++) {
        await waitForResume(); signal?.throwIfAborted()
        if (guard && !exclusions.beforeRequest(current)) return { ...empty(current), chain, excludedRedirect: current }
        if (visited.has(current)) return { ...empty(current), chain, failure: 'redirect' }
        visited.add(current)
        let info
        try { info = await fetchResource(current, 'GET', maxBytes, { trace, fresh: true, htmlOnly, manualRedirect: guard && excludeNonIndexable }) }
        catch (error) { if (signal?.aborted) throw error; return { ...empty(current), chain, failure: 'network' } }
        signal?.throwIfAborted()
        timingKnown &&= info.ttfb != null
        elapsed += info.ttfb || 0
        const combined = { ...info, chain: [...chain, ...(info.chain || [])], ttfb: timingKnown ? elapsed : null }
        if (!info.redirectUrl) return combined
        if (guard && !exclusions.afterResponse({ url: current, response: info })) return combined
        const next = normalizeAuditUrl(info.redirectUrl, current)
        if (!next) return { ...combined, failure: 'redirect' }
        if (guard && !exclusions.beforeRequest(next)) return { ...combined, excludedRedirect: next }
        chain.push({ url: current, status: info.status, headers: info.headers || {}, redirectUrl: next })
        current = next
    }
    return { ...empty(current), chain, failure: 'redirect' }
}

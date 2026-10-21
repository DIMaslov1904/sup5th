import { extensionApi } from '../platform/extensionApi.js'
import { observeSeoRequest, seoResponseHeaders } from './seoRequestTrace.js'
export const fetchSeoResource = async ({ url, method = 'GET', timeout = 20000, maxBytes = 200000, trace = false, fresh = false }, sender = {}) => {
    const empty = { ok: false, status: 0, url: '', headers: {}, text: '', ttfb: null }
    let parsed
    try { parsed = new URL(url) } catch { return empty }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || !['GET', 'HEAD'].includes(method)) return empty
    // activeTab is a temporary tab grant. Let Chrome enforce it for the page's
    // own origin instead of treating persisted host permissions as authoritative.
    let sourceOrigin = ''
    try { if (sender.tab) sourceOrigin = new URL(sender.url).origin } catch { /* No content-script sender. */ }
    if (sourceOrigin !== parsed.origin && !await hasOrigin(url)) return { ...empty, failure: 'permission' }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), Math.min(Math.max(Number(timeout) || 20000, 1000), 30000))
    const limit = Math.min(Math.max(Number(maxBytes) || 200000, 1000), 8 * 1024 * 1024)
    const started = performance.now()
    const observer = trace ? observeSeoRequest({ webRequest: extensionApi.webRequest, extensionUrl: extensionApi.runtime.getURL(''), url: parsed.href, method }) : null
    try {
        const response = await fetch(parsed.href, { method, credentials: 'omit', redirect: 'follow', ...(trace || fresh ? { cache: 'no-store' } : {}), signal: controller.signal })
        const ttfb = Math.round(performance.now() - started)
        let stream = response.body
        // HTTP Content-Encoding is decoded by fetch; .xml.gz served as a file needs decoding here.
        if (stream && /\.gz(?:\?|$)/i.test(response.url || parsed.href) && !/gzip/i.test(response.headers.get('content-encoding') || '')) {
            const [probe, data] = stream.tee(), reader = probe.getReader(), first = await reader.read()
            reader.cancel().catch(() => {})
            if (first.value?.[0] === 0x1f && first.value?.[1] === 0x8b) stream = data.pipeThrough(new DecompressionStream('gzip'))
            else stream = data
        }
        const reader = stream?.getReader(), chunks = []; let size = 0, truncated = false
        if (reader) while (true) {
            const { done, value } = await reader.read(); if (done) break
            const take = Math.min(value.length, limit - size); chunks.push(value.slice(0, take)); size += take
            if (take < value.length) { truncated = true; await reader.cancel(); break }
        }
        const bytes = new Uint8Array(size); let offset = 0
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
        return { ok: response.ok, status: response.status, url: response.url || parsed.href, headers: seoResponseHeaders(Object.fromEntries(response.headers.entries())), text: new TextDecoder().decode(bytes), ttfb, truncated, ...(observer?.result(response) || {}) }
    } catch (error) { return { ...empty, error: error.message, failure: controller.signal.aborted ? 'timeout' : 'network' } }
    finally { clearTimeout(timer); observer?.dispose() }
}
import { hasOrigin } from '../utils/hostPermissions.js'

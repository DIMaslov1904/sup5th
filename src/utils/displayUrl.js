import { toUnicode } from 'punycode/punycode.es6.js'

// Decode only the hostname for presentation; keep stored URLs and link targets intact.
export const displayUrl = value => {
    const source = String(value || '')
    try {
        const parsed = new URL(source.includes('://') ? source : `https://${source}`)
        if (!['http:', 'https:'].includes(parsed.protocol)) return source
        const hostname = toUnicode(parsed.hostname)
        if (hostname === parsed.hostname) return source
        return source.replace(/^((?:https?:\/\/)?)([^/?#]+)([\s\S]*)$/i, (_match, prefix, authority, rest) => {
            const offset = authority.toLowerCase().lastIndexOf(parsed.hostname)
            if (offset < 0) return _match
            return prefix + authority.slice(0, offset) + hostname + authority.slice(offset + parsed.hostname.length) + rest
        })
    } catch { return source }
}

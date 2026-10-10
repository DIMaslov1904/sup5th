export const ICON_CACHE_LIMIT = 50 * 1024 * 1024
export const ICON_INPUT_LIMIT = 512 * 1024
export const ICON_SVG_LIMIT = 128 * 1024
export const ICON_REQUEST_GAP = 2500
export const ICON_RETRY_DELAY = 24 * 60 * 60 * 1000

export const iconOrigin = value => {
    try {
        const text = String(value || '').trim()
        const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(text) && !/^[^/?#:]+:\d+(?:\/|$)/.test(text)
        const url = new URL(hasScheme ? text : `https://${text}`)
        if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return ''
        return url.origin
    } catch { return '' }
}

export const catalogueOrigins = items => [...new Set(items.map(item => iconOrigin(item.url)).filter(Boolean))]

export const iconInitials = name => String(name || '?').trim().split(/\s+/).slice(0, 2).map(word => Array.from(word)[0]).join('').toUpperCase()

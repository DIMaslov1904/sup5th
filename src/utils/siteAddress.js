export const parseSiteAddress = value => {
    const text = String(value || '').trim()
    const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(text) ? text : `https://${text}`)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Некорректный адрес сайта')
    return url
}

// Scheme-independent catalogue identity, with the port retained.
export const siteKey = value => { try { return parseSiteAddress(value).host.toLowerCase() } catch { return '' } }
export const siteHref = value => { try { return parseSiteAddress(value).href } catch { return '' } }

// The leading ! is catalogue syntax, never part of a navigable URL.
export const normalizeSiteRule = value => {
    const text = String(value || '').trim()
    const includeSubdomains = !text.startsWith('!')
    const address = includeSubdomains ? text : text.slice(1).trim()
    return { url: siteKey(address), siteUrl: siteHref(address), includeSubdomains }
}

export const createAccessIndex = accesses => {
    const records = new Map()
    for (const access of accesses) {
        const key = siteKey(access.url)
        if (!key) continue
        if (!records.has(key)) records.set(key, [])
        records.get(key).push(access)
    }
    return value => {
        let parsed
        try { parsed = parseSiteAddress(value) } catch { return [] }
        const suffix = parsed.port ? `:${parsed.port}` : ''
        let hostname = parsed.hostname
        while (hostname) {
            const found = records.get(hostname + suffix)
            const matches = hostname === parsed.hostname ? found : found?.filter(access => access.includeSubdomains !== false)
            if (matches?.length) return matches
            if (hostname.startsWith('[') || !hostname.includes('.')) break
            hostname = hostname.slice(hostname.indexOf('.') + 1)
        }
        return []
    }
}

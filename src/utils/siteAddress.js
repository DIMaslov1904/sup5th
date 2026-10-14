export const parseSiteAddress = value => {
    const text = String(value || '').trim()
    const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(text) ? text : `https://${text}`)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Некорректный адрес сайта')
    return url
}

// Scheme-independent catalogue identity, with the port retained.
export const siteKey = value => { try { return parseSiteAddress(value).host.toLowerCase() } catch { return '' } }
export const siteHref = value => { try { return parseSiteAddress(value).href } catch { return '' } }

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
            if (found) return found
            if (hostname.startsWith('[') || !hostname.includes('.')) break
            hostname = hostname.slice(hostname.indexOf('.') + 1)
        }
        return []
    }
}

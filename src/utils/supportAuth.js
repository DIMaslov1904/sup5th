export const SUPPORT_ORIGIN = 'https://support.5th.ru'
export const SUPPORT_LOGIN_PATH = '/published/login.php'
export const SUPPORT_EXPIRED_PATH = '/published/common/html/scripts/expired.php'
export const SUPPORT_INDEX_PATH = '/published/index.php'

export const supportUrl = value => {
    try {
        const url = new URL(value)
        return url.origin === SUPPORT_ORIGIN && !url.username && !url.password ? url : null
    } catch { return null }
}

// The server receives `from` but never receives the fragment containing the ticket.
export const supportTicketTarget = value => {
    const page = supportUrl(value)
    if (!page) return ''
    let target = page
    if ([SUPPORT_LOGIN_PATH, SUPPORT_EXPIRED_PATH].includes(page.pathname)) {
        const from = page.searchParams.get('from')
        if (!from) return ''
        try { target = supportUrl(new URL(from, SUPPORT_ORIGIN).href) }
        catch { return '' }
        if (!target) return ''
        if (!target.hash) target.hash = page.hash
    }
    const match = target.hash.match(/^#\/requests\/search\/([1-9]\d*)\/?$/)
    if (target.pathname !== SUPPORT_INDEX_PATH || target.searchParams.get('app') !== 'ST' || !match) return ''
    return `${SUPPORT_ORIGIN}${SUPPORT_INDEX_PATH}?app=ST#/requests/search/${match[1]}/`
}

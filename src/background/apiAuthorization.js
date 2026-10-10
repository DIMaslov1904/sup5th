export const classifyApiAuthorization = (response, text) => {
    const html = response.headers.get('content-type')?.toLowerCase().includes('text/html') || /^\s*</.test(text)
    // Inspect HTML before generic Google links: error and consent pages contain them too.
    const title = text.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1]
        .replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
    const body = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
    if (html && title === 'error' && /Authorization is required to perform that action/i.test(body)) return 'access_denied'
    if (html && title === 'authorization needed') return 'authorization_needed'
    let googleLogin = false
    try { googleLogin = new URL(response.url).hostname === 'accounts.google.com' } catch { /* No final URL. */ }
    if ([401, 403].includes(response.status) || googleLogin) return 'login_required'
    if (html && /accounts\.google\.com|ServiceLogin|Sign in|Войдите|You need access|Authorization required/i.test(text)) return 'login_required'
    return ''
}

export const apiAuthorizationError = (status, kind) => {
    const messages = {
        login_required: kind === 'доступов'
            ? 'Авторизуйтесь в Google под аккаунтом владельца API доступов и повторите загрузку'
            : 'Авторизуйтесь в Google под аккаунтом с доступом к документу проектов и повторите загрузку',
        access_denied: 'Доступ к документу ограничен, запросите доступ у владельца документа и повторите загрузку',
        authorization_needed: 'Подтвердите разрешения Apps Script на странице API и повторите загрузку'
    }
    const error = new Error(messages[status])
    error.apiStatus = status
    return error
}

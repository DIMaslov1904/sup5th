export const originPattern = value => {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Требуется HTTP или HTTPS адрес')
    return `${url.protocol}//${url.hostname}/*`
}
export const requestOrigins = async urls => {
    const origins = [...new Set(urls.filter(Boolean).map(originPattern))]
    if (!origins.length) return
    // Call directly from the click handler, before other asynchronous work.
    if (!await chrome.permissions.request({ origins })) throw new Error('Доступ к сайтам не предоставлен')
}
export const hasOrigin = url => chrome.permissions.contains({ origins: [originPattern(url)] })

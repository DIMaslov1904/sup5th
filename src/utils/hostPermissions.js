export const originPattern = value => {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Требуется HTTP или HTTPS адрес')
    return `${url.protocol}//${url.hostname}/*`
}
export const hasOrigin = url => chrome.permissions.contains({ origins: [originPattern(url)] })

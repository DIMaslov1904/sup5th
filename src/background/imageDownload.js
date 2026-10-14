export const downloadSeoImage = async ({ url }, sender) => {
    const internal = sender?.id === chrome.runtime.id && sender.url?.startsWith(chrome.runtime.getURL(''))
    const content = sender?.id === chrome.runtime.id && sender.frameId === 0 && /^https?:\/\//.test(sender.url || '')
    if (!internal && !content) throw new Error('Скачивание доступно только из интерфейса расширения')
    let parsed
    try { parsed = new URL(url) } catch { throw new Error('Некорректный адрес изображения') }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error('Изображение должно иметь HTTP или HTTPS адрес')
    const id = await chrome.downloads.download({ url: parsed.href, conflictAction: 'uniquify' })
    return { id }
}

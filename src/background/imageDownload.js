import { extensionApi } from '../platform/extensionApi.js'
export const downloadSeoImage = async ({ url }, sender) => {
    const internal = sender?.id === extensionApi.runtime.id && sender.url?.startsWith(extensionApi.runtime.getURL(''))
    const content = sender?.id === extensionApi.runtime.id && sender.frameId === 0 && /^https?:\/\//.test(sender.url || '')
    if (!internal && !content) throw new Error('Скачивание доступно только из интерфейса расширения')
    let parsed
    try { parsed = new URL(url) } catch { throw new Error('Некорректный адрес изображения') }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error('Изображение должно иметь HTTP или HTTPS адрес')
    if (!extensionApi.downloads?.download) {
        await extensionApi.tabs.create({ url: parsed.href })
        return { opened: true }
    }
    const id = await extensionApi.downloads.download({ url: parsed.href, conflictAction: 'uniquify' })
    return { id }
}

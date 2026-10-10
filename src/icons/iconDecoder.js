const path = 'src/offscreen/index.html'
let creating
let operations = Promise.resolve()
const serial = action => {
    const result = operations.then(action)
    operations = result.catch(() => {})
    return result
}
const ensureDecoder = async () => {
    if (creating) return creating
    creating = (async () => {
        const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'], documentUrls: [chrome.runtime.getURL(path)] })
        if (!contexts.length) await chrome.offscreen.createDocument({ url: path, reasons: ['DOM_PARSER', 'BLOBS'], justification: 'Поиск favicon и уменьшение ICO, PNG и JPEG для локального кеша' })
    })().finally(() => { creating = null })
    return creating
}

export const decodeIconMessage = payload => serial(async () => {
    await ensureDecoder()
    let timer
    const response = await Promise.race([
        chrome.runtime.sendMessage({ ...payload, target: 'icon-decoder' }),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Обработка иконки заняла слишком много времени')), 10000) })
    ]).finally(() => clearTimeout(timer))
    if (!response?.ok) throw new Error(response?.error || 'Обработчик иконок недоступен')
    return response.data
})

export const closeIconDecoder = () => serial(async () => {
    if (creating) await creating
    const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'], documentUrls: [chrome.runtime.getURL(path)] })
    if (contexts.length) await chrome.offscreen.closeDocument()
})

export const blobDataUrl = async blob => {
    const bytes = new Uint8Array(await blob.arrayBuffer())
    let binary = ''
    for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192))
    return `data:${blob.type || 'application/octet-stream'};base64,${btoa(binary)}`
}

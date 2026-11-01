import { extensionApi } from '../platform/extensionApi.js'
import { decodeIconPayload } from './iconPayload.js'
import { createSerialQueue } from '../utils/serialQueue.js'
const path = 'src/offscreen/index.html'
let creating
const serial = createSerialQueue()
const ensureDecoder = async () => {
    if (creating) return creating
    creating = (async () => {
        const contexts = await extensionApi.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'], documentUrls: [extensionApi.runtime.getURL(path)] })
        if (!contexts.length) await extensionApi.offscreen.createDocument({ url: path, reasons: ['DOM_PARSER', 'BLOBS'], justification: 'Поиск favicon и уменьшение ICO, PNG и JPEG для локального кеша' })
    })().finally(() => { creating = null })
    return creating
}

export const decodeIconMessage = payload => serial(async () => {
    if (typeof document !== 'undefined') return decodeIconPayload(payload)
    await ensureDecoder()
    let timer
    const response = await Promise.race([
        extensionApi.runtime.sendMessage({ ...payload, target: 'icon-decoder' }),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Обработка иконки заняла слишком много времени')), 10000) })
    ]).finally(() => clearTimeout(timer))
    if (!response?.ok) throw new Error(response?.error || 'Обработчик иконок недоступен')
    return response.data
})

export const closeIconDecoder = () => serial(async () => {
    if (typeof document !== 'undefined') return
    if (creating) await creating
    const contexts = await extensionApi.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'], documentUrls: [extensionApi.runtime.getURL(path)] })
    if (contexts.length) await extensionApi.offscreen.closeDocument()
})


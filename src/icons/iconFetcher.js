import { ICON_INPUT_LIMIT, ICON_REQUEST_GAP } from './iconPolicy.js'
import { blobDataUrl, decodeIconMessage } from './iconDecoder.js'

const wait = (ms, signal) => new Promise((resolve, reject) => {
    signal.throwIfAborted()
    const abort = () => { clearTimeout(timer); reject(signal.reason) }
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve() }, ms)
    signal.addEventListener('abort', abort, { once: true })
})

export const createIconFetcher = repository => {
    const request = async (url, limit, signal) => {
        const delay = Math.max(0, (await repository.getNextRequestAt() || 0) - Date.now())
        if (delay) await wait(delay, signal)
        signal.throwIfAborted()
        await repository.setNextRequestAt(Date.now() + ICON_REQUEST_GAP)
        const timeout = AbortSignal.timeout(15000)
        const combined = AbortSignal.any([signal, timeout])
        const response = await fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer', signal: combined })
        if (!response.ok || Number(response.headers.get('content-length')) > limit) {
            await response.body?.cancel().catch(() => {})
            throw new Error(!response.ok ? `HTTP ${response.status}` : 'Файл иконки слишком большой')
        }
        const reader = response.body.getReader(), chunks = []
        let size = 0
        try {
            while (true) {
                const { done, value } = await reader.read()
                if (done) break
                size += value.byteLength
                if (size > limit) throw new Error('Файл иконки слишком большой')
                chunks.push(value)
            }
        } finally { await reader.cancel().catch(() => {}) }
        return { blob: new Blob(chunks, { type: response.headers.get('content-type')?.split(';')[0] || '' }), url: response.url || url }
    }
    return async (origin, signal) => {
        let candidates = [origin + '/favicon.ico']
        try {
            const page = await request(origin + '/', 1024 * 1024, signal)
            candidates = await decodeIconMessage({ type: 'candidates', html: await page.blob.text(), url: page.url })
        } catch { signal.throwIfAborted() }
        let failure
        for (const url of candidates) {
            try {
                const file = await request(url, ICON_INPUT_LIMIT, signal)
                const dataUrl = await decodeIconMessage({ type: 'normalize', dataUrl: await blobDataUrl(file.blob) })
                signal.throwIfAborted()
                const image = await (await fetch(dataUrl)).blob()
                return { image, sourceUrl: file.url }
            } catch (error) { signal.throwIfAborted(); failure = error }
        }
        throw failure || new Error('Иконка сайта не найдена')
    }
}

import { isSafari } from '../platform/extensionApi.js'

// Safari requires write() in the click handler, before async credential reads.
// ClipboardItem accepts a promise, so plaintext need not be cached in the UI.
export const copyText = async (value, { skip } = {}) => {
    if (!isSafari) {
        const text = await value
        if (skip !== undefined && text === skip) return skip
        await navigator.clipboard.writeText(String(text ?? ''))
        return
    }
    const skipped = new Error('Копирование выполнено на странице проверки устройства')
    let failure
    const data = Promise.resolve(value).then(text => {
        if (skip !== undefined && text === skip) throw skipped
        return new Blob([String(text ?? '')], { type: 'text/plain' })
    }).catch(error => { failure = error; throw error })
    // Handle rejection even if Safari refuses the clipboard before reading data.
    data.catch(() => {})
    try { await navigator.clipboard.write([new ClipboardItem({ 'text/plain': data })]) }
    catch (error) { if (failure !== skipped) throw failure || error; return skip }
}

import { extensionApi } from '../platform/extensionApi.js'
import { findIconCandidates, normalizeIcon } from '../icons/iconDom.js'

extensionApi.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.target !== 'icon-decoder' || sender.id !== extensionApi.runtime.id || !sender.url?.startsWith(extensionApi.runtime.getURL(''))) return false
    const run = async () => {
        if (message.type === 'candidates') return findIconCandidates(message.html, message.url)
        if (message.type !== 'normalize') throw new Error('Неизвестная операция иконки')
        const response = await fetch(message.dataUrl)
        const blob = await normalizeIcon(await response.blob())
        return await new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result)
            reader.onerror = () => reject(reader.error)
            reader.readAsDataURL(blob)
        })
    }
    run().then(data => respond({ ok: true, data }), error => respond({ ok: false, error: error.message }))
    return true
})

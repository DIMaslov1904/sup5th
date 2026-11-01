import { extensionApi } from '../platform/extensionApi.js'
import { decodeIconPayload } from '../icons/iconPayload.js'

extensionApi.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.target !== 'icon-decoder' || sender.id !== extensionApi.runtime.id || !sender.url?.startsWith(extensionApi.runtime.getURL(''))) return false
    const run = () => decodeIconPayload(message)
    run().then(data => respond({ ok: true, data }), error => respond({ ok: false, error: error.message }))
    return true
})

import { extensionApi } from '../platform/extensionApi.js'

// Opens a blank tab, stores its session state, then navigates it to the target.
// The blank step guarantees the session exists before the page starts loading.
export const openTabWithSession = async (targetUrl, writeSession, forgetSession) => {
    const tab = await extensionApi.tabs.create({ url: 'about:blank' })
    try {
        await writeSession(tab.id)
        await extensionApi.tabs.update(tab.id, { url: targetUrl })
    } catch (error) {
        await forgetSession?.(tab.id)
        await extensionApi.tabs.remove(tab.id).catch(() => {})
        throw error
    }
    return tab
}

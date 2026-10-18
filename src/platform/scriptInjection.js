// @ts-check
import { extensionApi } from './extensionApi.js'

/** @param {number} tabId @param {string} scriptPath */
export const injectExtensionScript = async (tabId, scriptPath) => {
    const base = extensionApi.runtime.getURL('')
    const url = new URL(scriptPath, base)
    if (!url.href.startsWith(base)) throw new Error('Скрипт должен находиться внутри расширения')
    // Firefox resolves a bare path relative to the calling extension page.
    const results = await extensionApi.scripting.executeScript({ target: { tabId }, files: [url.pathname] })
    const failure = results.find(result => 'error' in result && result.error)
    if (failure && 'error' in failure) throw new Error(String(failure.error))
    return results
}

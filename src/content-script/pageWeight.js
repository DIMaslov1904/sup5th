// Только текущая загрузка вкладки: без повторного скачивания HTML и ресурсов.
export const collectPageWeight = (doc, timing = performance) => {
    const navigation = timing.getEntriesByType('navigation')[0]
    const resources = timing.getEntriesByType('resource').filter(entry => /^https?:\/\//i.test(entry.name))
    const entries = [navigation, ...resources].filter(Boolean)
    // Все нули могут означать закрытые Timing-Allow-Origin данные, а не пустой файл.
    const known = entries.filter(entry => [entry.decodedBodySize, entry.encodedBodySize, entry.transferSize].some(value => value > 0))
    const unknown = entries.length - known.length + Number(!navigation)
    const iframeCount = doc.querySelectorAll('iframe').length
    const partial = unknown > 0 || iframeCount > 0 || resources.length >= 250 || doc.readyState !== 'complete'
    const sum = property => known.length ? known.reduce((total, entry) => total + (entry[property] || 0), 0) : null
    const domBytes = new TextEncoder().encode((doc.doctype ? `<!DOCTYPE ${doc.doctype.name}>\n` : '') + doc.documentElement.outerHTML).byteLength
    return {
        htmlBytes: navigation?.decodedBodySize > 0 ? navigation.decodedBodySize : domBytes,
        htmlEstimated: !(navigation?.decodedBodySize > 0),
        bodyBytes: sum('decodedBodySize'), transferBytes: sum('transferSize'),
        resources: resources.length, unknown, iframeCount, partial,
        bufferMayBeFull: resources.length >= 250, loading: doc.readyState !== 'complete'
    }
}

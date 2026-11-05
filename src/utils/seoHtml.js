import { fetchSeo } from './seoClient.js'
import { AUDIT_HTML_LIMIT } from './seoAuditPages.js'
import { seoDocumentBase } from './seoDom.js'
import { collectSeoReport } from './seoReport.js'
import { seoResponsePatch } from './seoNetwork.js'

export const fetchSeoDocument = async requestedUrl => {
    const info = await fetchSeo(requestedUrl, 'GET', AUDIT_HTML_LIMIT, { trace: true, htmlOnly: true })
    if (!info.status) {
        const messages = {
            permission: 'Предоставьте расширению доступ к сайту и повторите проверку.',
            timeout: 'Сайт не ответил вовремя. Повторите проверку.'
        }
        throw new Error(messages[info.failure] || 'Не удалось получить ответ сайта. Проверьте адрес и повторите проверку.')
    }
    if (info.truncated) throw new Error('HTML страницы превышает лимит 1 МБ.')
    if (!info.text.trim()) throw new Error(`В ответе HTTP ${info.status} отсутствует HTML страницы.`)

    const url = info.url || requestedUrl
    // Parsed nodes stay in the detached document. The interface only receives report data.
    const document = new DOMParser().parseFromString(info.text, 'text/html')
    return { info, document, url, baseUrl: seoDocumentBase(document, url) }
}

export const loadSeoHtml = async (requestedUrl, { includeAuditLinks = false } = {}) => {
    const { info, document, url } = await fetchSeoDocument(requestedUrl)
    const report = collectSeoReport(document, url, { includeAuditLinks, source: 'html' })
    return { ...report, ...seoResponsePatch(report, info, requestedUrl), requestedUrl, pageWeight: null, cwv: null }
}

import { encodeAuditCsv } from './seoAuditCsv.js'

export const AUDIT_KIND_LABELS = { page: 'Страница', image: 'Изображение', document: 'Файл', resource: 'Ресурс' }
const httpStatusGroups = ['1xx', '2xx', '3xx', '4xx', '5xx']
const httpStatusGroup = status => httpStatusGroups[Math.floor(status / 100) - 1] || 'unknown'
export const AUDIT_HTTP_FILTERS = [
    { value: 'all', label: 'Все статусы' },
    { value: '1xx', label: 'Ответы 1xx' }, { value: '2xx', label: 'Ответы 2xx' }, { value: '3xx', label: 'Ответы 3xx' },
    { value: '4xx', label: 'Ошибки 4xx' }, { value: '5xx', label: 'Ошибки 5xx' },
    { value: 'unknown', label: 'HTTP-статус неизвестен' }, { value: 'problems', label: 'Ошибки и ограничения' },
    { value: 'uncertain', label: 'Неизвестно / ограничения' }, { value: 'ok', label: 'Успешные' }
]
const matchesStatus = (item, status) => {
    if (status === '3xx' || status === 'redirects') return item.redirected === true || httpStatusGroup(item.status) === '3xx'
    if (status === 'unknown' || httpStatusGroups.includes(status)) return httpStatusGroup(item.status) === status
    if (status === 'uncertain') return !['ok', 'broken', 'server'].includes(item.outcome)
    if (status === 'problems') return item.outcome !== 'ok' || item.status >= 400
    if (status === 'ok') return item.outcome === 'ok'
    return true
}
export const countAuditHttpStatuses = results => {
    const counts = { '1xx': 0, '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0, unknown: 0 }
    for (const item of results) {
        const group = httpStatusGroup(item.status)
        counts[group]++
        if (group !== '3xx' && item.redirected === true) counts['3xx']++
    }
    return counts
}
export const filterAuditResults = (results, { status = 'all', kind = 'all', query = '' } = {}) => {
    const needle = String(query).trim().toLowerCase()
    const searchable = value => {
        try { return decodeURIComponent(value).toLowerCase() } catch { return String(value).toLowerCase() }
    }
    return results.filter(item => matchesStatus(item, status) && (kind === 'all' || item.kind === kind)
        && (!needle || [item.url, item.finalUrl, ...(item.sources || []), ...(item.sitemaps || [])].some(value => searchable(value).includes(needle))))
}
export const paginateAuditResults = (results, page = 1, pageSize = 25) => {
    const size = [25, 50, 100].includes(Number(pageSize)) ? Number(pageSize) : 25
    const count = Math.max(1, Math.ceil(results.length / size)), current = Math.min(count, Math.max(1, Math.trunc(Number(page)) || 1))
    const start = (current - 1) * size
    return { items: results.slice(start, start + size), page: current, count, start: results.length ? start + 1 : 0, end: Math.min(start + size, results.length) }
}
export const auditResultsCsv = (results, directionOf = null) => encodeAuditCsv([
    ['URL', 'HTTP', 'Тип', 'Конечный URL', ...(directionOf ? ['Направление'] : []), 'Страницы-источники', 'Sitemap', 'Результат'],
    ...results.map(item => [item.url, item.status || '', AUDIT_KIND_LABELS[item.kind] || '', item.finalUrl,
        ...(directionOf ? [directionOf(item) || ''] : []),
        (item.sources || []).join('\n'), (item.sitemaps || []).join('\n'), item.label])
])

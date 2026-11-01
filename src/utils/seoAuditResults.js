export const AUDIT_KIND_LABELS = { page: 'Страница', image: 'Изображение', document: 'Файл', resource: 'Ресурс' }
export const AUDIT_HTTP_FILTERS = [
    { value: 'all', label: 'Все статусы' }, { value: 'problems', label: 'Ошибки и ограничения' },
    { value: '4xx', label: 'Ошибки 4xx' }, { value: '5xx', label: 'Ошибки 5xx' },
    { value: 'redirects', label: 'Редиректы' }, { value: 'uncertain', label: 'Неизвестно / ограничения' }, { value: 'ok', label: 'Успешные' }
]
const matchesStatus = (item, status) => {
    if (status === '4xx') return item.status >= 400 && item.status < 500
    if (status === '5xx') return item.status >= 500 && item.status < 600
    if (status === 'redirects') return item.redirected === true
    if (status === 'uncertain') return !['ok', 'broken', 'server'].includes(item.outcome)
    if (status === 'problems') return item.outcome !== 'ok' || item.status >= 400
    if (status === 'ok') return item.outcome === 'ok'
    return true
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
const csvCell = value => `"${String(value ?? '').replace(/"/g, '""')}"`
export const auditResultsCsv = results => '\uFEFF' + [
    ['URL', 'HTTP', 'Тип', 'Конечный URL', 'Страницы-источники', 'Sitemap', 'Результат'],
    ...results.map(item => [item.url, item.status || '', AUDIT_KIND_LABELS[item.kind] || '', item.finalUrl,
        (item.sources || []).join('\n'), (item.sitemaps || []).join('\n'), item.label])
].map(row => row.map(csvCell).join(';')).join('\r\n')

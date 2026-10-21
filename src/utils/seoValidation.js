// Editorial heuristics, not search-engine limits. Snippets depend on width and query.
export const META_LENGTH_RANGES = {
    title: { min: 30, max: 65, low: 20, high: 80 },
    description: { min: 70, max: 160, low: 50, high: 200 }
}
export const evaluateMetaLength = (value, field) => {
    const length = [...String(value || '').trim()].length
    const { min, max, low, high } = META_LENGTH_RANGES[field]
    const range = `Ориентир: ${min}–${max} символов.`
    if (!length) return { status: 'danger', hint: `Не заполнен. ${range}` }
    const status = length < low || length > high ? 'danger' : length < min || length > max ? 'warning' : 'success'
    const reason = length < min ? 'Мало информации: проверьте полноту текста.' : length > max ? 'Текст может обрезаться в выдаче.' : 'Длина в рекомендуемом диапазоне.'
    return { status, hint: `${length} симв. ${reason} ${range}` }
}
export const evaluateHttpStatus = (status, redirected = false) => {
    if (!status) return { status: 'warning', hint: 'HTTP-статус не получен. Повторный запрос без cookies мог быть недоступен; это не доказывает ошибку страницы.' }
    if (status >= 500) return { status: 'danger', hint: 'Ошибка сервера. Поисковый робот может не получить содержимое страницы.' }
    if (status >= 400) return { status: 'danger', hint: [404, 410].includes(status) ? 'Страница не найдена или удалена. Проверьте URL и необходимость её индексации.' : 'Ошибка доступа или запроса. Проверьте авторизацию, защиту сайта и ограничения запросов.' }
    if (redirected || (status >= 300 && status < 400)) return { status: 'warning', hint: redirected ? 'Повторный запрос перешёл на другой URL. Показан конечный статус; проверьте целевой адрес и Canonical.' : 'Ответ 3xx. Проверьте редирект; 304 означает использование кеша, а не перенаправление.' }
    if (status === 200) return { status: 'success', hint: 'Успешный ответ повторного запроса без cookies' }
    return { status: 'warning', hint: 'Необычный ответ для HTML-страницы. Проверьте наличие полноценного содержимого.' }
}
const metaName = item => String(item.name || '').trim().toLowerCase()
const namedMeta = report => (report.metaTags || []).filter(item => metaName(item) && metaName(item) !== '(без названия)')
const withTagChecks = (row, tags) => {
    const problems = []
    if (tags.length > 1) problems.push(`Найдено тегов: ${tags.length}. Оставьте один.`)
    if (tags.some(item => item.inHead === false)) problems.push('Тег вне head: перенесите в head.')
    return problems.length ? { ...row, status: 'danger', hint: `${problems.join(' ')} ${row.hint || ''}`.trim() } : row
}
const canonicalMetadata = report => {
    const row = { label: 'Canonical', value: report.canonical || 'Не указан', copyValue: report.canonical || '', status: 'warning', hint: 'Не указан предпочтительный URL. Это не всегда ошибка, но для дублей стоит задать Canonical.' }
    const tags = report.canonicals || []
    if (report.canonical || tags.length) {
        let valid = false
        try { valid = /^https?:$/.test(new URL(report.canonical).protocol) && !tags.some(item => item.raw === '') } catch {}
        row.status = valid ? 'success' : 'danger'
        row.hint = valid ? 'Указан HTTP(S) URL. Проверьте, что это нужная индексируемая страница; её ответ здесь не проверяется.' : 'Canonical пуст или содержит некорректный HTTP(S) URL.'
    }
    return withTagChecks(row, tags)
}
export const primaryMetadata = report => {
    const meta = namedMeta(report)
    return [
        withTagChecks({ label: 'Title', value: report.title || 'Отсутствует', copyValue: report.title || '', ...evaluateMetaLength(report.title, 'title') }, report.titles || []),
        withTagChecks({ label: 'Description', value: report.description || 'Отсутствует', copyValue: report.description || '', ...evaluateMetaLength(report.description, 'description') }, meta.filter(item => metaName(item) === 'description')),
        withTagChecks({ label: 'Keywords', value: report.keywords || 'Не заданы' }, meta.filter(item => metaName(item) === 'keywords')),
        canonicalMetadata(report),
        withTagChecks({ label: 'Robots', value: report.robots || 'Не задан', status: report.robotsAllowed === false ? 'warning' : 'success', hint: report.robotsAllowed === false ? 'Meta robots запрещает индексацию. Проверьте, нужен ли noindex для этой страницы.' : 'В общем meta robots нет запрета noindex. Заголовки HTTP и правила роботов смотрите в «Индексация».' }, meta.filter(item => metaName(item) === 'robots'))
    ]
}
export const advancedMetadata = report => namedMeta(report)
    .filter(item => !['description', 'keywords', 'robots'].includes(metaName(item)))
    .map(item => ({ label: metaName(item) === 'viewport' ? 'Viewport' : item.name, value: item.content, warning: item.inHead === false ? 'вне head' : '' }))

import { evaluateRobotsFile, indexingRulesFromMeta } from './seoRules.js'
import { summarizeAuditPages, normalizeAuditText } from './seoAuditPages.js'
import { META_LENGTH_RANGES } from './seoValidation.js'
const check = (id, label, status, hint = '') => ({ id, label, status, hint })
const lengthCheck = (field, value) => {
    const length = [...String(value || '').trim()].length, { min, max } = META_LENGTH_RANGES[field]
    return check(`${field}-length`, `${field === 'title' ? 'Title' : 'Description'}: длина (ориентир)`, !length ? 'na' : length >= min && length <= max ? 'pass' : 'warning', `${length} символов; ориентир ${min}–${max}`)
}
const canonicalCheck = data => {
    const tags = data.canonicals || []
    if (!tags.length) return check('canonical', 'Canonical в DOM', 'warning', 'Не указан; необходимость зависит от дублей страницы')
    let valid = tags.length === 1 && tags[0].inHead !== false && Boolean(tags[0].raw?.trim())
    try { const url = new URL(tags[0].href); valid &&= /^https?:$/.test(url.protocol) && !url.username && !url.password && !url.hash } catch { valid = false }
    return check('canonical', 'Canonical в DOM', valid ? 'pass' : 'fail', valid ? `${tags[0].href} — адрес указан, ответ целевой страницы не проверялся` : 'Нужен один непустой HTTP(S) URL без фрагмента в head')
}
export const buildAuditChecks = (data, audit) => {
    const pages = summarizeAuditPages(audit.results), current = audit.results.find(item => item.url === audit.sample.urls[0])
    const http = current?.response, headerKnown = http?.ok && http.status === 200 && /^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i.test(http.headers['content-type'] || '')
    const tags = data.indexingMeta || (data.metaTags || []).filter(item => !item.attribute || item.attribute === 'name')
    const meta = indexingRulesFromMeta(tags), headers = http?.xRobotsTags || http?.headers?.['x-robots-tag'] || ''
    const indexing = indexingRulesFromMeta([], headers), serverIndexing = indexingRulesFromMeta(current?.indexingMeta || [], headers)
    const h1 = (data.headingRows || []).filter(item => item.level === 1)
    const descriptions = (data.metaTags || []).filter(item => (!item.attribute || item.attribute === 'name') && item.name?.toLowerCase() === 'description')
    const titles = data.titles || [], links = data.linkRows || [], images = data.images || { total: 0, withoutAlt: 0 }
    const titleProblems = [!data.title ? 'Title отсутствует или пустой' : '', titles.length > 1 ? `Тегов Title: ${titles.length}` : '', titles.some(item => item.inHead === false) ? 'Title вне head' : ''].filter(Boolean)
    const descriptionProblems = [descriptions.length > 1 ? `Тегов Description: ${descriptions.length}` : '', descriptions.some(item => item.inHead === false) ? 'Description вне head' : ''].filter(Boolean)
    const list = [
        check('title', 'Title в DOM', titleProblems.length ? 'fail' : 'pass', titleProblems.join('; ') || data.title),
        lengthCheck('title', data.title),
        check('description', 'Description в DOM', descriptionProblems.length ? 'fail' : data.description ? 'pass' : 'warning', descriptionProblems.join('; ') || data.description || 'Не указан'),
        lengthCheck('description', data.description),
        check('h1', 'H1 в DOM', h1.length === 1 && h1[0].text.trim() ? 'pass' : 'warning', `Всего H1: ${h1.length}; пустых: ${h1.filter(item => !item.text.trim()).length}`),
        canonicalCheck(data),
        check('index-meta', 'Общий meta robots: нет noindex', meta.robotsAllowed ? 'pass' : 'fail', meta.robots || 'Директива не указана'),
        check('index-xrobots', 'X-Robots-Tag: нет общего noindex', indexing.xRobotsAllowed === false ? 'fail' : headerKnown && indexing.xRobotsAllowed !== null ? 'pass' : 'unknown', indexing.xRobotsAllowed === null ? 'Объединённые заголовки: область действия noindex неизвестна' : http?.headers?.['x-robots-tag'] || (headerKnown ? 'Директива не указана' : 'HTML-ответ страницы не подтверждён')),
        ...meta.indexingAgents.map(item => check(`index-${item.agent}`, `DOM: нет noindex для ${item.agent}`, item.allowed ? 'pass' : 'fail', item.allowed ? 'В метатегах DOM запрета нет' : 'В метатегах DOM найден noindex')),
        ...serverIndexing.indexingAgents.map(item => check(`index-server-${item.agent}`, `HTML / HTTP GET: нет noindex для ${item.agent}`, item.allowed === false ? 'fail' : item.allowed !== null && headerKnown && current?.metaState === 'complete' ? 'pass' : 'unknown', item.allowed === false ? 'В HTML или HTTP-ответе найден noindex' : item.allowed === null ? 'Границы X-Robots-Tag недоступны; действие для робота неизвестно' : headerKnown && current?.metaState === 'complete' ? 'В полученных директивах запрета нет' : 'Полный HTML-ответ не подтверждён')),
        ...['googlebot', 'yandex'].map(agent => { const rule = evaluateRobotsFile(audit.robotsFile, data.url, agent); return check(`crawl-${agent}`, `robots.txt: обход для ${agent}`, rule.allowed === null ? 'unknown' : rule.allowed ? 'pass' : 'fail', rule.rules[0] ? `${rule.rules[0].directive}: ${rule.rules[0].value}` : rule.allowed === null ? 'Правила не получены полностью' : 'Подходящих ограничений не найдено') }),
        check('http', 'HTTP повторного GET-запроса', !current || !['ok', 'broken', 'server'].includes(current.outcome) ? 'unknown' : current.outcome !== 'ok' ? 'fail' : current.status === 200 ? 'pass' : 'warning', current?.label || 'Ответ не получен'),
        check('redirect', 'Конечный URL повторного запроса', !http?.status ? 'unknown' : current.redirected ? 'warning' : 'pass', http?.status ? current.finalUrl : 'Ответ не получен'),
        check('representation', 'DOM и HTML повторного GET: метаданные', current?.metaState !== 'complete' ? 'unknown' : current.title === normalizeAuditText(data.title) && current.description === normalizeAuditText(data.description) ? 'pass' : 'warning', current?.metaState !== 'complete' ? 'Полный HTML не получен' : current.title === normalizeAuditText(data.title) && current.description === normalizeAuditText(data.description) ? 'Title и Description совпадают' : 'Title/Description различаются; проверьте JavaScript, авторизацию и защиту сайта'),
        check('links-http', 'HTTP-ошибки в проверенной выборке', pages.broken || pages.serverErrors ? 'fail' : pages.uncertain || audit.partial || audit.results.length < audit.sample.urls.length ? 'unknown' : 'pass', `404/410: ${pages.broken}; 5xx: ${pages.serverErrors}; неизвестно: ${pages.uncertain}; проверено: ${audit.results.length}/${audit.sample.urls.length}`),
        check('links-text', 'Ссылки: текст или подпись в DOM', !links.length ? 'na' : links.some(item => !(item.accessibleName ?? item.text)?.trim()) ? 'warning' : 'pass', `Без текста/подписи: ${links.filter(item => !(item.accessibleName ?? item.text)?.trim()).length}`),
        check('images-alt', 'Изображения: атрибут alt в DOM', !images.total ? 'na' : images.withoutAlt ? 'warning' : 'pass', `Изображений: ${images.total}; без атрибута alt: ${images.withoutAlt}`),
        check('lang', 'Атрибут lang в DOM', data.lang ? 'pass' : 'warning', data.lang || 'Не указан'),
        check('viewport', 'Meta viewport в DOM', data.viewport ? 'pass' : 'warning', data.viewport ? 'Указан' : 'Не указан')
    ]
    for (const [field, label, count, duplicates] of [['title', 'Title', pages.titleCount, pages.duplicateTitles], ['description', 'Description', pages.descriptionCount, pages.duplicateDescriptions]]) {
        list.push(check(`duplicates-${field}`, `Нет совпадений ${label} в полученных HTML`, count < 2 ? 'unknown' : duplicates.length ? 'warning' : 'pass', `Уникальных конечных URL с ${label}: ${count}; групп совпадений: ${duplicates.length}`))
    }
    const sitemap = audit.sitemap
    list.push(check('sitemap', 'Обработка обнаруженных sitemap', sitemap.state === 'missing' ? 'warning' : sitemap.state === 'invalid' ? 'fail' : sitemap.state === 'unknown' || !sitemap.complete ? 'unknown' : 'pass', sitemap.state === 'missing' ? 'Sitemap не найден; файл не обязателен для каждого сайта' : `Прочитано XML-файлов: ${sitemap.files.length}; ошибок: ${sitemap.errors.length}`))
    list.push(check('sitemap-current', 'Текущий URL в обработанных sitemap', sitemap.containsCurrent ? 'pass' : sitemap.state === 'missing' ? 'na' : !sitemap.complete ? 'unknown' : 'warning', sitemap.containsCurrent ? 'URL найден' : sitemap.complete ? 'URL не найден; проверьте необходимость его включения' : 'Полная проверка не выполнена'))
    return list
}
export const summarizeAuditChecks = checks => Object.fromEntries(['pass', 'fail', 'warning', 'unknown', 'na'].map(status => [status, checks.filter(item => item.status === status).length]))

import { evaluateRobotsFile, indexingRulesFromMeta } from './seoRules.js'
import { summarizeAuditPages, normalizeAuditText } from './seoAuditPages.js'
import { META_LENGTH_RANGES } from './seoValidation.js'
import { CWV_THRESHOLDS } from './cwv.js'
const check = (id, label, status, hint = '') => ({ id, label, status, hint })
const lengthCheck = (field, value) => {
    const length = [...String(value || '').trim()].length, { min, max } = META_LENGTH_RANGES[field]
    return check(`${field}-length`, `${field === 'title' ? 'Title' : 'Description'}: длина (ориентир)`, !length ? 'na' : length >= min && length <= max ? 'pass' : 'warning', `${length} символов; ориентир ${min}–${max}`)
}
const withoutHash = url => { const copy = new URL(url); copy.hash = ''; return copy.href }
const canonicalCheck = (data, finalUrl) => {
    const tags = data.canonicals || []
    if (!tags.length) return check('canonical', 'Canonical в DOM', 'warning', 'Не указан; необходимость зависит от дублей страницы')
    let valid = tags.length === 1 && tags[0].inHead !== false && Boolean(tags[0].raw?.trim())
    try { const url = new URL(tags[0].href); valid &&= /^https?:$/.test(url.protocol) && !url.username && !url.password && !url.hash } catch { valid = false }
    if (!valid) return check('canonical', 'Canonical в DOM', 'fail', 'Нужен один непустой HTTP(S) URL без фрагмента в head')
    let consistency = ''
    try {
        if (finalUrl && withoutHash(tags[0].href) !== withoutHash(finalUrl)) {
            consistency = `Canonical не совпадает с конечным URL страницы (${withoutHash(finalUrl)}); проверьте консистентность. Ответ целевого адреса не проверялся.`
        }
    } catch { /* finalUrl некорректен — консистентность не оценить */ }
    return check('canonical', 'Canonical в DOM', consistency ? 'warning' : 'pass', consistency || `${tags[0].href} — совпадает с конечным URL; ответ целевой страницы не проверялся`)
}
const h1Check = (data, h1) => {
    const first = h1.map(item => item.text.trim()).find(Boolean) || ''
    const problems = [], notes = []
    if (!h1.length) problems.push('H1 отсутствует')
    if (h1.length > 1) problems.push(`Всего H1: ${h1.length}`)
    if (h1.some(item => !item.text.trim())) notes.push(`пустых H1: ${h1.filter(item => !item.text.trim()).length}`)
    if (first) {
        const length = [...first].length, { min, max } = META_LENGTH_RANGES.h1
        if (length < min || length > max) problems.push(`Длина H1: ${length} симв.; ориентир ${min}–${max}`)
        const title = String(data.title || '').trim().toLowerCase()
        if (title && first.toLowerCase() === title) notes.push('H1 полностью совпадает с Title')
        const topWords = (data.statistics?.top || []).map(item => String(item.word).toLowerCase()).slice(0, 10)
        if (topWords.length && !topWords.some(word => first.toLowerCase().includes(word))) notes.push('H1 не содержит частотные слова страницы')
    }
    const status = h1.length === 1 && first ? problems.length ? 'warning' : 'pass' : 'warning'
    return check('h1', 'H1 в DOM', status, [...problems, ...notes].join('; ') || first)
}
const charsetCheck = (data, http) => {
    const meta = (data.charset?.document || data.charset?.meta || '').trim()
    const httpCharset = String(http?.headers?.['content-type'] || '').match(/charset=([\w-]+)/i)?.[1]?.trim() || ''
    if (!meta && !httpCharset) return check('charset', 'Кодировка', 'warning', 'Meta charset и HTTP charset не объявлены')
    if (meta && httpCharset) {
        const consistent = meta.toLowerCase() === httpCharset.toLowerCase()
        return check('charset', 'Кодировка', !consistent ? 'fail' : /^utf-?8$/i.test(meta) ? 'pass' : 'warning', consistent
            ? `Meta и HTTP совпадают: ${meta}${/^utf-?8$/i.test(meta) ? '' : '; рекомендуется UTF-8'}`
            : `Несоответствие: meta ${meta}, HTTP ${httpCharset}`)
    }
    const known = meta || httpCharset
    return check('charset', 'Кодировка', /^utf-?8$/i.test(known) ? 'unknown' : 'warning', `Объявлена только в ${meta ? 'meta' : 'HTTP'}: ${known}; вторая часть не подтверждена`)
}
const twitterCheck = data => {
    const twitter = data.twitter
    if (!twitter) return check('twitter', 'Twitter Cards', 'unknown', 'Мета twitter: не собраны')
    const filled = Object.values(twitter).filter(Boolean).length
    if (!twitter.card) return check('twitter', 'Twitter Cards', 'warning', 'twitter:card не указан; карточка формируется из Open Graph или не создаётся')
    const missing = ['title', 'description', 'image'].filter(field => !twitter[field])
    return check('twitter', 'Twitter Cards', missing.length ? 'warning' : 'pass', missing.length
        ? `card: ${twitter.card}; не хватает: ${missing.join(', ')}` : `card: ${twitter.card}; все основные поля заполнены`)
}
const faviconCheck = data => {
    const favicon = data.favicon
    if (!favicon || typeof favicon !== 'object') return check('favicon', 'Favicon', 'unknown', 'Данные favicon не собраны')
    const types = [favicon.ico ? 'favicon (.ico)' : '', favicon.apple ? 'apple-touch-icon' : '', favicon.mask ? 'mask-icon' : ''].filter(Boolean)
    const sizes = Array.isArray(favicon.sizes) && favicon.sizes.length ? ` · sizes: ${favicon.sizes.join(', ')}` : ''
    if (favicon.ico && favicon.apple) return check('favicon', 'Favicon', 'pass', `Найдены основные типы: ${types.join(', ')}${sizes}`)
    if (types.length) return check('favicon', 'Favicon', 'warning', `Найден только: ${types.join(', ')}; рекомендуется добавить ${favicon.ico ? 'apple-touch-icon' : 'favicon (.ico)'}`)
    return check('favicon', 'Favicon', 'warning', 'Favicon не найден в head; браузеры и поисковики используют /favicon.ico по умолчанию')
}
// X-Robots-Tag на каждом хопе цепочки редиректа (заголовки собираются в seoRequestTrace/createAuditFetch)
const xRobotsChainCheck = (current, data) => {
    const chain = [...(current?.response?.chain || current?.chain || data?.response?.chain || [])]
    const hops = chain.filter(hop => hop?.url)
    const redirected = hops.some(hop => hop.redirectUrl) || hops.length > 1
    if (!redirected) return check('xrobots-chain', 'X-Robots-Tag на всех хопах редиректа', 'na', 'Редиректы не обнаружены; X-Robots-Tag финального ответа проверяется отдельной проверкой')
    const detect = hop => {
        const explicit = Array.isArray(hop.xRobotsTags) && hop.xRobotsTags.length ? hop.xRobotsTags : null
        const header = hop.headers?.['x-robots-tag'] ?? ''
        return explicit || (String(header) ? [header] : [])
    }
    const flagged = hops.filter(hop => detect(hop).some(value => /noindex/i.test(value)))
    if (flagged.length) return check('xrobots-chain', 'X-Robots-Tag на всех хопах редиректа', 'warning', `noindex найден на ${flagged.length} из ${hops.length} хопов (${flagged.map(hop => `${hop.status} ${hop.url}`).join('; ')})`)
    const confirmed = hops.filter(hop => detect(hop).length).length
    return check('xrobots-chain', 'X-Robots-Tag на всех хопах редиректа', confirmed === hops.length ? 'pass' : 'unknown', confirmed === hops.length
        ? `noindex не найден ни на одном из ${hops.length} хопов`
        : `Заголовки подтверждены на ${confirmed} из ${hops.length} хопов; полная цепочка не отслежена`)
}
const sslCheck = data => {
    const ssl = data.ssl
    if (!ssl) return check('ssl', 'HTTPS и mixed content', 'unknown', 'Данные протокола не собраны')
    if (!ssl.https) return check('ssl', 'HTTPS и mixed content', 'fail', 'Страница открыта по HTTP')
    return check('ssl', 'HTTPS и mixed content', ssl.mixedContent ? 'warning' : 'pass', ssl.mixedContent
        ? `Страница по HTTPS, но найдено незащищённых ресурсов: ${ssl.mixedContent}`
        : 'Страница по HTTPS, незащищённых ресурсов не найдено')
}
export const buildAuditChecks = (data, audit) => {
    const pages = summarizeAuditPages(audit.pageResults || audit.results), targets = summarizeAuditPages(audit.results)
    const current = (audit.pageResults || audit.results).find(item => item.url === new URL(data.url).href.split('#')[0])
    const http = current?.response, headerKnown = http?.ok && http.status === 200 && /^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i.test(http.headers['content-type'] || '')
    const tags = data.indexingMeta || (data.metaTags || []).filter(item => !item.attribute || item.attribute === 'name')
    const meta = indexingRulesFromMeta(tags), headers = http?.xRobotsTags || http?.headers?.['x-robots-tag'] || ''
    const indexing = indexingRulesFromMeta([], headers), serverIndexing = indexingRulesFromMeta(current?.indexingMeta || [], headers)
    const h1 = (data.headingRows || []).filter(item => item.level === 1)
    const descriptions = (data.metaTags || []).filter(item => (!item.attribute || item.attribute === 'name') && item.name?.toLowerCase() === 'description')
    const titles = data.titles || [], links = data.linkRows || [], images = data.images || { total: 0, withoutAlt: 0 }
    const finalUrl = current?.finalUrl || data.finalUrl || ''
    const titleProblems = [!data.title ? 'Title отсутствует или пустой' : '', titles.length > 1 ? `Тегов Title: ${titles.length}` : '', titles.some(item => item.inHead === false) ? 'Title вне head' : ''].filter(Boolean)
    const descriptionProblems = [descriptions.length > 1 ? `Тегов Description: ${descriptions.length}` : '', descriptions.some(item => item.inHead === false) ? 'Description вне head' : ''].filter(Boolean)
    const list = [
        check('title', 'Title в DOM', titleProblems.length ? 'fail' : 'pass', titleProblems.join('; ') || data.title),
        lengthCheck('title', data.title),
        check('description', 'Description в DOM', descriptionProblems.length ? 'fail' : data.description ? 'pass' : 'warning', descriptionProblems.join('; ') || data.description || 'Не указан'),
        lengthCheck('description', data.description),
        h1Check(data, h1),
        canonicalCheck(data, finalUrl),
        charsetCheck(data, http),
        twitterCheck(data),
        sslCheck(data),
        faviconCheck(data),
        check('index-meta', 'Общий meta robots: нет noindex', meta.robotsAllowed ? 'pass' : 'fail', meta.robots || 'Директива не указана'),
        xRobotsChainCheck(current, data),
        check('index-xrobots', 'X-Robots-Tag: нет общего noindex', indexing.xRobotsAllowed === false ? 'fail' : headerKnown && indexing.xRobotsAllowed !== null ? 'pass' : 'unknown', indexing.xRobotsAllowed === null ? 'Объединённые заголовки: область действия noindex неизвестна' : http?.headers?.['x-robots-tag'] || (headerKnown ? 'Директива не указана' : 'HTML-ответ страницы не подтверждён')),
        ...meta.indexingAgents.map(item => check(`index-${item.agent}`, `DOM: нет noindex для ${item.agent}`, item.allowed ? 'pass' : 'fail', item.allowed ? 'В метатегах DOM запрета нет' : 'В метатегах DOM найден noindex')),
        ...serverIndexing.indexingAgents.map(item => check(`index-server-${item.agent}`, `HTML / HTTP GET: нет noindex для ${item.agent}`, item.allowed === false ? 'fail' : item.allowed !== null && headerKnown && current?.metaState === 'complete' ? 'pass' : 'unknown', item.allowed === false ? 'В HTML или HTTP-ответе найден noindex' : item.allowed === null ? 'Границы X-Robots-Tag недоступны; действие для робота неизвестно' : headerKnown && current?.metaState === 'complete' ? 'В полученных директивах запрета нет' : 'Полный HTML-ответ не подтверждён')),
        ...['googlebot', 'yandex'].map(agent => { const rule = evaluateRobotsFile(audit.robotsFile, data.url, agent); return check(`crawl-${agent}`, `robots.txt: обход для ${agent}`, rule.allowed === null ? 'unknown' : rule.allowed ? 'pass' : 'fail', rule.rules[0] ? `${rule.rules[0].directive}: ${rule.rules[0].value}` : rule.allowed === null ? 'Правила не получены полностью' : 'Подходящих ограничений не найдено') }),
        check('http', 'HTTP повторного GET-запроса', !current || !['ok', 'broken', 'server'].includes(current.outcome) ? 'unknown' : current.outcome !== 'ok' ? 'fail' : current.status === 200 ? 'pass' : 'warning', current?.label || 'Ответ не получен'),
        check('redirect', 'Конечный URL повторного запроса', !http?.status ? 'unknown' : current.redirected ? 'warning' : 'pass', http?.status ? current.finalUrl : 'Ответ не получен'),
        check('representation', 'DOM и HTML повторного GET: метаданные', current?.metaState !== 'complete' ? 'unknown' : current.title === normalizeAuditText(data.title) && current.description === normalizeAuditText(data.description) ? 'pass' : 'warning', current?.metaState !== 'complete' ? 'Полный HTML не получен' : current.title === normalizeAuditText(data.title) && current.description === normalizeAuditText(data.description) ? 'Title и Description совпадают' : 'Title/Description различаются; проверьте JavaScript, авторизацию и защиту сайта'),
        check('links-http', 'HTTP-ошибки проверенных URL', targets.broken || targets.serverErrors ? 'fail' : targets.uncertain || audit.partial || audit.results.length < audit.sample.total || audit.sample.limited || audit.crawl?.complete === false ? 'unknown' : 'pass', `404/410: ${targets.broken}; 5xx: ${targets.serverErrors}; неизвестно: ${targets.uncertain}; проверено: ${audit.results.length}/${audit.sample.total}`),
        check('links-text', 'Ссылки: текст или подпись в DOM', !links.length ? 'na' : links.some(item => !(item.accessibleName ?? item.text)?.trim()) ? 'warning' : 'pass', `Без текста/подписи: ${links.filter(item => !(item.accessibleName ?? item.text)?.trim()).length}`),
        check('images-alt', 'Изображения: атрибут alt в DOM', !images.total ? 'na' : images.withoutAlt ? 'warning' : 'pass', `Изображений: ${images.total}; без атрибута alt: ${images.withoutAlt}`),
        check('lang', 'Атрибут lang в DOM', data.lang ? 'pass' : 'warning', data.lang || 'Не указан'),
        check('viewport', 'Meta viewport в DOM', data.viewport ? 'pass' : 'warning', data.viewport ? 'Указан' : 'Не указан')
    ]
    // Core Web Vitals check
    const cwv = data.cwv
    if (cwv) {
        const metrics = []
        const cwvStatuses = []

        if (cwv.lcp) {
            const label = `LCP: ${(cwv.lcp.value / 1000).toFixed(2)}с`
            metrics.push(label)
            cwvStatuses.push(cwv.lcp.rating)
        }
        if (cwv.cls != null) {
            const label = `CLS: ${cwv.cls.toFixed(3)}`
            metrics.push(label)
            cwvStatuses.push(cwv.clsRating)
        }
        if (cwv.inp) {
            const label = `INP: ${cwv.inp.value}мс`
            metrics.push(label)
            cwvStatuses.push(cwv.inp.rating)
        }
        if (cwv.fcp) {
            const label = `FCP: ${(cwv.fcp.value / 1000).toFixed(2)}с`
            metrics.push(label)
            cwvStatuses.push(cwv.fcp.rating)
        }

        const hasGood = cwvStatuses.some(r => r === 'good')
        const hasPoor = cwvStatuses.some(r => r === 'poor')
        const cwvStatus = cwvStatuses.length === 0 ? 'unknown' : hasPoor ? 'fail' : hasGood && cwvStatuses.every(r => r === 'good') ? 'pass' : 'warning'

        list.push(check('cwv', 'Core Web Vitals', cwvStatus, metrics.join(' · ') || 'Не измерено'))

        // Individual CWV metric checks
        if (cwv.lcp) {
            const lcpStatus = cwv.lcp.rating === 'good' ? 'pass' : cwv.lcp.rating === 'poor' ? 'fail' : 'warning'
            const hint = cwv.lcp.element ? `${(cwv.lcp.value / 1000).toFixed(2)}с — элемент: ${cwv.lcp.element}` : `${(cwv.lcp.value / 1000).toFixed(2)}с; ориентир ≤${CWV_THRESHOLDS.lcp.good / 1000}с`
            list.push(check('cwv-lcp', 'LCP: крупнейший контент', lcpStatus, hint))
        }
        if (cwv.cls != null) {
            const clsStatus = cwv.clsRating === 'good' ? 'pass' : cwv.clsRating === 'poor' ? 'fail' : 'warning'
            list.push(check('cwv-cls', 'CLS: сдвиг макета', clsStatus, cwv.clsRating === 'good' ? `Сдвиг минимальный: ${cwv.cls.toFixed(3)}` : `Сдвиг макета: ${cwv.cls.toFixed(3)}; ориентир ≤${CWV_THRESHOLDS.cls.good}`))
        }
        if (cwv.inp) {
            const inpStatus = cwv.inp.rating === 'good' ? 'pass' : cwv.inp.rating === 'poor' ? 'fail' : 'warning'
            const note = cwv.inp.note ? ` (${cwv.inp.note})` : ''
            list.push(check('cwv-inp', 'INP: отклик ввода', inpStatus, `${cwv.inp.value}мс${note}; ориентир ≤${CWV_THRESHOLDS.inp.good}мс`))
        }
        if (cwv.fcp) {
            const fcpStatus = cwv.fcp.rating === 'good' ? 'pass' : cwv.fcp.rating === 'poor' ? 'fail' : 'warning'
            list.push(check('cwv-fcp', 'FCP: первая отрисовка', fcpStatus, `${(cwv.fcp.value / 1000).toFixed(2)}с; ориентир ≤${CWV_THRESHOLDS.fcp.good / 1000}с`))
        }
    } else {
        list.push(check('cwv', 'Core Web Vitals', 'unknown', 'Метрики не собраны'))
    }
    for (const [field, label, count, duplicates] of [['title', 'Title', pages.titleCount, pages.duplicateTitles], ['description', 'Description', pages.descriptionCount, pages.duplicateDescriptions]]) {
        list.push(check(`duplicates-${field}`, `Нет совпадений ${label} в полученных HTML`, count < 2 ? 'unknown' : duplicates.length ? 'warning' : 'pass', `Уникальных конечных URL с ${label}: ${count}; групп совпадений: ${duplicates.length}`))
    }
    const sitemap = audit.sitemap
    list.push(check('sitemap', 'Обработка обнаруженных sitemap', sitemap.state === 'missing' ? 'warning' : sitemap.state === 'invalid' ? 'fail' : sitemap.state === 'unknown' || !sitemap.complete ? 'unknown' : 'pass', sitemap.state === 'missing' ? 'Sitemap не найден; файл не обязателен для каждого сайта' : `Прочитано XML-файлов: ${sitemap.files.length}; ошибок: ${sitemap.errors.length}`))
    list.push(check('sitemap-current', 'Текущий URL в обработанных sitemap', sitemap.containsCurrent ? 'pass' : sitemap.state === 'missing' ? 'na' : !sitemap.complete ? 'unknown' : 'warning', sitemap.containsCurrent ? 'URL найден' : sitemap.complete ? 'URL не найден; проверьте необходимость его включения' : 'Полная проверка не выполнена'))
    const llmTxt = data.llmTxt
    list.push(check('llm-txt', 'Файл llm.txt', !llmTxt || llmTxt.pending ? 'unknown' : llmTxt.exists ? 'pass' : 'warning', !llmTxt || llmTxt.pending
        ? 'Файл ещё не проверен'
        : llmTxt.exists ? `Найден в корне сайта${llmTxt.size ? ` · ${llmTxt.size} симв.` : ''}; полезен для LLM-краулеров` : 'Не найден в корне сайта; не обязателен, но помогает LLM-краулерам понять сайт'))
    return list
}
export const summarizeAuditChecks = checks => Object.fromEntries(['pass', 'fail', 'warning', 'unknown', 'na'].map(status => [status, checks.filter(item => item.status === status).length]))

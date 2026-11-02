import { summarizeAuditPages, uniqueAuditPages } from './seoAuditPages.js'
import { normalizeAuditUrl } from './seoAuditLinks.js'
import { indexingRulesFromMeta } from './seoRules.js'
import { SEO_AUDIT_HELP } from './seoAuditHelp.js'

export const ISSUE_CATEGORIES = [
    ['meta', 'Метатеги'],
    ['content', 'Контент и изображения'],
    ['index', 'Индексация'],
    ['links', 'Ссылки и HTTP'],
    ['performance', 'Скорость'],
    ['files', 'Файлы'],
    ['other', 'Прочее']
]
export const ISSUE_STATUS_LABELS = { pass: 'Подтверждено', fail: 'Ошибка', warning: 'Рекомендация', unknown: 'Не удалось подтвердить', na: 'Не применимо' }
export const ISSUE_COLORS = { pass: 'text-ui-success', fail: 'text-ui-danger', warning: 'text-ui-warning', unknown: 'text-ui-muted', na: 'text-ui-muted' }
export const ISSUE_SEVERITIES = [['critical', 'Критические проблемы'], ['warning', 'Рекомендации'], ['info', 'Информация и результаты проверок']]
export const ISSUE_SEVERITY_LABELS = { critical: 'критично', warning: 'важно', info: 'инфо' }
export const ISSUE_SCOPE_LABELS = { page: 'Только исходная страница', site: 'Проверенная часть сайта', file: 'Файлы сайта' }
export const isAuditProblem = issue => ['fail', 'warning'].includes(issue.status)

const CATEGORY_BY_ID = {
    title: 'meta', 'title-length': 'meta', description: 'meta', 'description-length': 'meta',
    canonical: 'meta', charset: 'meta', twitter: 'meta', favicon: 'meta',
    'duplicates-title': 'meta', 'duplicates-description': 'meta',
    'pages-missing-title': 'meta', 'pages-missing-description': 'meta',
    'pages-noindex': 'index', 'links-redirects': 'links', 'pages-http': 'links', 'links-unconfirmed': 'links',
    h1: 'content', 'pages-h1': 'content', 'images-alt': 'content', 'links-text': 'content',
    lang: 'content', viewport: 'content',
    'index-meta': 'index', 'index-xrobots': 'index', 'xrobots-chain': 'index',
    'index-googlebot': 'index', 'index-yandex': 'index',
    'index-server-googlebot': 'index', 'index-server-yandex': 'index',
    'crawl-googlebot': 'index', 'crawl-yandex': 'index',
    http: 'links', redirect: 'links', representation: 'links', 'links-http': 'links',
    cwv: 'performance', 'cwv-lcp': 'performance', 'cwv-cls': 'performance',
    'cwv-inp': 'performance', 'cwv-fcp': 'performance',
    sitemap: 'files', 'sitemap-current': 'files', 'llm-txt': 'files',
    ssl: 'other'
}

// Проверки, которые относятся только к снимку текущей страницы.
const PAGE_SCOPED = new Set([
    'title', 'title-length', 'description', 'description-length', 'h1', 'canonical',
    'charset', 'twitter', 'ssl', 'favicon', 'index-meta', 'index-xrobots',
    'index-googlebot', 'index-yandex', 'crawl-googlebot', 'crawl-yandex',
    'http', 'redirect', 'representation', 'links-text', 'images-alt', 'lang', 'viewport',
    'cwv', 'cwv-lcp', 'cwv-cls', 'cwv-inp', 'cwv-fcp'
])

const SEVERITY_BY_STATUS = { fail: 'critical', warning: 'warning', unknown: 'info', pass: 'info', na: 'info' }

const pageUrl = page => page.finalUrl || page.url
const unique = values => [...new Set(values.filter(Boolean))]

const toIssue = (check, urls, scope = 'site') => {
    const list = unique(urls)
    return {
        ...check,
        urls: list,
        urlCount: list.length,
        scope,
        severity: SEVERITY_BY_STATUS[check.status] || 'info',
        category: CATEGORY_BY_ID[check.id] || 'other',
        help: SEO_AUDIT_HELP[check.id] || { why: check.hint, how: '' }
    }
}

/**
 * Превращает плоский список проверок в проблемы с адресами, где они найдены.
 * Один проход по результатам аудита; списки URL собираются по предикатам.
 */
export const buildAuditIssues = (report, audit, checks = []) => {
    const results = audit?.results || []
    const pageResults = audit?.pageResults || []
    const pages = uniqueAuditPages(pageResults)
    const pageSummary = summarizeAuditPages(pageResults)
    const current = normalizeAuditUrl(report?.url)
    const currentResult = pageResults.find(item => item.url === current) || results.find(item => item.url === current)
    const chain = currentResult?.response?.chain || report?.response?.chain || []
    const sitemapFiles = audit?.sitemap?.files || [], sitemapErrors = audit?.sitemap?.errors || []
    const sitemapUrls = [...sitemapFiles, ...sitemapErrors].map(file => normalizeAuditUrl(file.url))
    const httpUrls = { fail: [], unknown: [], pass: [] }
    const redirectedUrls = []
    const checkedUrls = new Set()
    for (const item of results) {
        const status = ['broken', 'server'].includes(item.outcome) ? 'fail' : item.outcome === 'ok' ? 'pass' : 'unknown'
        httpUrls[status].push(item.url)
        checkedUrls.add(item.url)
        if (item.redirected) redirectedUrls.push(item.url)
    }
    const pageUrls = { 'pages-missing-title': [], 'pages-missing-description': [], 'pages-h1': [], 'pages-noindex': [] }
    for (const page of pages) {
        const url = pageUrl(page)
        if (!page.title?.trim()) pageUrls['pages-missing-title'].push(url)
        if (!page.description?.trim()) pageUrls['pages-missing-description'].push(url)
        if (page.h1s?.length !== 1 || !page.h1s?.[0]?.trim()) pageUrls['pages-h1'].push(url)
        const indexing = indexingRulesFromMeta(page.indexingMeta || [], page.response?.xRobotsTags || page.response?.headers?.['x-robots-tag'] || '')
        if (indexing.indexingAgents.some(item => item.allowed === false)) pageUrls['pages-noindex'].push(url)
    }
    const pageHttpErrors = []
    for (const page of pageResults) if (!checkedUrls.has(page.url)) {
        if (['broken', 'server'].includes(page.outcome)) pageHttpErrors.push(page.url)
        if (page.redirected) redirectedUrls.push(page.url)
    }
    const duplicateUrls = groups => unique(groups.flatMap(group => group.urls))

    const urlsFor = ({ id, status }) => {
        if (id === 'links-http') return httpUrls[status] || []
        if (id === 'duplicates-title') return duplicateUrls(pageSummary.duplicateTitles)
        if (id === 'duplicates-description') return duplicateUrls(pageSummary.duplicateDescriptions)
        if (id === 'sitemap') return status === 'fail' ? sitemapErrors.map(file => normalizeAuditUrl(file.url)) : sitemapUrls
        if (id === 'sitemap-current') return sitemapFiles.map(file => file.url)
        if (id === 'llm-txt') return audit?.llmTxt || report?.llmTxt ? [audit?.llmTxt?.url || report?.llmTxt?.url || new URL('/llm.txt', current).href] : []
        if (id === 'xrobots-chain') return chain.filter(hop => status !== 'warning' || /noindex/i.test([hop.xRobotsTags || '', hop.headers?.['x-robots-tag'] || ''].join(', '))).map(hop => hop.url)
        if (id.startsWith('index-server-')) return [current]
        if (PAGE_SCOPED.has(id)) return [current]
        return []
    }

    const issues = checks.map(check => toIssue(check, urlsFor(check),
        ['sitemap', 'sitemap-current', 'llm-txt'].includes(check.id) || check.id.startsWith('crawl-') ? 'file'
            : PAGE_SCOPED.has(check.id) || check.id.startsWith('index-server-') || check.id === 'xrobots-chain' ? 'page' : 'site'))
    // robots.txt is a file check; link to the file whose rules produced the result.
    for (const issue of issues) if (issue.id.startsWith('crawl-')) {
        issue.urls = unique([audit?.robotsFile?.url]); issue.urlCount = issue.urls.length
    }
    for (const [id, label, hint] of [
        ['pages-missing-title', 'Страницы без Title', 'Title не заполнен'],
        ['pages-missing-description', 'Страницы без Description', 'Description не заполнен'],
        ['pages-h1', 'Страницы без одного H1', 'H1 отсутствует, пустой или встречается несколько раз на странице'],
        ['pages-noindex', 'Страницы с запретом индексации', 'В HTML или HTTP-ответе есть noindex для Googlebot или Яндекса']
    ]) if (pageUrls[id].length) issues.push(toIssue({ id, label, status: 'warning', hint: `${hint} · ${pageUrls[id].length} URL` }, pageUrls[id]))
    if (redirectedUrls.length) issues.push(toIssue({ id: 'links-redirects', label: 'Редиректы проверенных URL', status: 'warning', hint: 'Проверьте необходимость переходов и обновите ссылки на конечные адреса' }, redirectedUrls))
    if (pageHttpErrors.length) issues.push(toIssue({ id: 'pages-http', label: 'HTTP-ошибки страниц при обходе', status: 'fail', hint: 'Внутренние страницы с 404/410 или 5xx при сборе внешних ссылок' }, pageHttpErrors))
    if (httpUrls.unknown.length && checks.some(check => check.id === 'links-http' && check.status === 'fail')) {
        issues.push(toIssue({ id: 'links-unconfirmed', label: 'HTTP-ответы, которые не удалось подтвердить', status: 'unknown', hint: 'Эти адреса проверены с ограничениями; недоступность не доказывает ошибку страницы' }, httpUrls.unknown))
    }

    return issues
}

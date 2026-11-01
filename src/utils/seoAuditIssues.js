import { indexingRulesFromMeta } from './seoRules.js'
import { summarizeAuditPages, uniqueAuditPages } from './seoAuditPages.js'
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

const CATEGORY_BY_ID = {
    title: 'meta', 'title-length': 'meta', description: 'meta', 'description-length': 'meta',
    canonical: 'meta', charset: 'meta', twitter: 'meta', favicon: 'meta',
    'duplicates-title': 'meta', 'duplicates-description': 'meta',
    'pages-missing-title': 'meta', 'pages-missing-description': 'meta',
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
const pageHeaders = page => page.response?.xRobotsTags || page.response?.headers?.['x-robots-tag'] || ''
const pageIndexing = page => indexingRulesFromMeta(page.indexingMeta || [], pageHeaders(page))
const agentAllowed = (page, agent) => pageIndexing(page).indexingAgents.find(item => item.agent === agent)?.allowed
const unique = values => [...new Set(values.filter(Boolean))]

const toIssue = (check, urls) => {
    const list = unique(urls)
    return {
        ...check,
        urls: list,
        urlCount: list.length,
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
    const current = report?.url || ''
    const chainUrls = (report?.response?.chain || []).map(hop => hop.url)
    const sitemapUrls = (audit?.sitemap?.files || []).map(file => file.url)
    const llmUrl = report?.llmTxt?.url || ''
    const linkProblems = results.filter(item => item.outcome && item.outcome !== 'ok').map(item => item.url)
    const duplicateUrls = groups => unique(groups.flatMap(group => group.urls))

    const urlsFor = id => {
        if (id === 'links-http') return linkProblems
        if (id === 'duplicates-title') return duplicateUrls(pageSummary.duplicateTitles)
        if (id === 'duplicates-description') return duplicateUrls(pageSummary.duplicateDescriptions)
        if (id === 'sitemap') return sitemapUrls
        if (id === 'sitemap-current') return [current]
        if (id === 'llm-txt') return [llmUrl]
        if (id === 'xrobots-chain') return chainUrls.length ? chainUrls : [current]
        if (id === 'index-server-googlebot') return pages.filter(page => agentAllowed(page, 'googlebot') === false).map(pageUrl)
        if (id === 'index-server-yandex') return pages.filter(page => agentAllowed(page, 'yandex') === false).map(pageUrl)
        if (PAGE_SCOPED.has(id)) return [current]
        return []
    }

    const issues = checks.map(check => toIssue(check, urlsFor(check.id)))
    const addPageIssue = (id, label, matched, hint) => {
        if (!matched.length) return
        issues.push(toIssue({ id, label, status: 'warning', hint }, matched.map(pageUrl)))
    }
    const pagesWithoutTitle = pages.filter(page => !page.title)
    const pagesWithoutDescription = pages.filter(page => !page.description)
    const pagesWithoutSingleH1 = pages.filter(page => (page.h1s?.length || 0) !== 1 || !page.h1s?.[0]?.trim())

    addPageIssue('pages-missing-title', 'Страницы без Title', pagesWithoutTitle,
        `Title не заполнен на ${pagesWithoutTitle.length} проверенных страницах`)
    addPageIssue('pages-missing-description', 'Страницы без Description', pagesWithoutDescription,
        `Description не заполнен на ${pagesWithoutDescription.length} проверенных страницах`)
    addPageIssue('pages-h1', 'Страницы без одного H1', pagesWithoutSingleH1,
        'H1 отсутствует, пустой или встречается несколько раз на странице')

    return issues
}

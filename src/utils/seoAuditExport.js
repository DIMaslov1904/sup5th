import { summarizeAuditChecks } from './seoAuditChecks.js'
import { ISSUE_STATUS_LABELS, ISSUE_SEVERITY_LABELS, ISSUE_SCOPE_LABELS } from './seoAuditIssues.js'

export const buildAuditExport = (report, audit, issues, { state = 'done', notice = '', generatedAt = new Date().toISOString() } = {}) => ({
    version: 1, generatedAt, state, notice,
    source: { url: report.url, scannedAt: report.scannedAt },
    settings: { mode: audit.mode, pageLimit: audit.sample.limit, crawlPageLimit: audit.crawl.limit, excludeNonIndexable: audit.exclusions?.enabled === true, customExclusions: audit.exclusions?.customExclusions || '' },
    summary: summarizeAuditChecks(issues),
    issues: issues.map(issue => ({ ...issue, statusLabel: ISSUE_STATUS_LABELS[issue.status], severityLabel: ISSUE_SEVERITY_LABELS[issue.severity], scopeLabel: ISSUE_SCOPE_LABELS[issue.scope] })),
    report, audit
})

export const auditIssuesCsv = issues => '\uFEFF' + [
    ['Проверка', 'Статус', 'Важность', 'Область проверки', 'URL', 'Количество URL', 'Результат', 'Почему важно', 'Что делать'],
    ...issues.map(issue => [issue.label, ISSUE_STATUS_LABELS[issue.status], ISSUE_SEVERITY_LABELS[issue.severity],
        ISSUE_SCOPE_LABELS[issue.scope], issue.urls.join('\n'), issue.urlCount, issue.hint, issue.help?.why, issue.help?.how])
].map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n')

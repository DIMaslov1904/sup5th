import { normalizeAuditUrl } from './seoAuditLinks.js'
import { isAuditProblem } from './seoAuditIssues.js'

// Index once, rather than scanning every issue for every table row.
export const buildAuditPageRows = (results = [], issues = []) => {
    const byUrl = new Map()
    for (const issue of issues) {
        if (['pass', 'na'].includes(issue.status) || issue.scope === 'file') continue
        for (const url of issue.urls) {
            const key = normalizeAuditUrl(url), matches = byUrl.get(key) || []
            matches.push(issue); byUrl.set(key, matches)
        }
    }
    return results.map(result => {
        const matches = [...new Map([...(byUrl.get(normalizeAuditUrl(result.url)) || []),
            ...(byUrl.get(normalizeAuditUrl(result.finalUrl)) || [])].map(issue => [issue.id, issue])).values()]
        const problems = matches.filter(isAuditProblem)
        return { ...result, issues: matches, problems, problemCount: problems.length, unknownCount: matches.length - problems.length }
    })
}

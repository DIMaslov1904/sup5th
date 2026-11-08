import { evaluateRobotsFile, indexingRulesFromMeta } from './seoRules.js'
import { normalizeAuditUrl } from './seoAuditLinks.js'
import { parseAuditExclusionLists, createAuditExclusionMatcher } from './seoAuditExclusionRules.js'

export const createAuditIndexability = (siteUrl, { enabled = true, maxExcluded = 50000, customExclusions = '', queryExclusions = '', cmsExclusions = '', onExclude = () => {} } = {}) => {
    const origin = new URL(siteUrl).origin, excluded = new Map(), allowed = new Set()
    const lists = parseAuditExclusionLists({ customExclusions, queryExclusions, cmsExclusions })
    const matchCustomRule = createAuditExclusionMatcher(...lists)
    let robots = { pending: true }, limited = false
    const internal = url => new URL(url).origin === origin
    const record = (url, reason, details = {}) => {
        const existing = excluded.get(url)
        if (!existing && excluded.size >= maxExcluded) { limited = true; return false }
        const entry = existing || { url, reason, sources: new Set(), sitemaps: new Set() }
        for (const field of ['sources', 'sitemaps']) for (const source of details[field] || []) entry[field].add(source)
        if (details.source === 'links' && details.sourceUrl) entry.sources.add(details.sourceUrl)
        if (details.source === 'sitemap' && details.sourceUrl) entry.sitemaps.add(details.sourceUrl)
        if (details.status) entry.status = details.status
        entry.current ||= details.current || details.source === 'current'
        excluded.set(url, entry); allowed.delete(url)
        if (!existing) onExclude(url)
        return false
    }
    const beforeRequest = (value, details = {}) => {
        const url = normalizeAuditUrl(value)
        if (!url) return true
        if (excluded.has(url)) return record(url, excluded.get(url).reason, details)
        if (allowed.has(url)) return true
        const customRule = matchCustomRule(url)
        if (customRule) return record(url, `${customRule.label} · Disallow: ${customRule.value}`, details)
        if (!enabled || !internal(url)) return true
        if (robots.pending) return true
        for (const agent of ['googlebot', 'yandex']) {
            const rule = evaluateRobotsFile(robots, url, agent)
            if (rule.allowed === false) return record(url, `robots.txt (${agent}): ${rule.rules[0].directive}: ${rule.rules[0].value}`, details)
        }
        allowed.add(url)
        return true
    }
    const afterResponse = (result, details = {}) => {
        if (result.excludedRedirect) return record(result.url, `Редирект на исключённый URL: ${result.excludedRedirect}`, { ...details, status: result.status })
        if (!enabled) return true
        if (!internal(result.url)) return true
        const headers = result.response?.xRobotsTags ?? result.response?.headers?.['x-robots-tag'] ?? ''
        const rules = indexingRulesFromMeta(result.indexingMeta || [], headers)
        if (rules.robotsAllowed === false) return record(result.url, 'Meta robots: noindex / none', { ...details, status: result.status })
        if (rules.xRobotsAllowed === false) return record(result.url, 'X-Robots-Tag: noindex / none', { ...details, status: result.status })
        const blocked = rules.indexingAgents.find(item => item.allowed === false)
        if (blocked) return record(result.url, `Meta / X-Robots-Tag (${blocked.agent}): noindex / none`, { ...details, status: result.status })
        return true
    }
    return {
        beforeRequest, afterResponse, has: url => excluded.has(url), hasCustomRules: lists.some(list => list.hasRules),
        setRobots: file => { robots = file; allowed.clear() },
        snapshot: () => ({ enabled, limited, items: [...excluded.values()].map(item => ({ ...item, sources: [...item.sources], sitemaps: [...item.sitemaps] })) })
    }
}

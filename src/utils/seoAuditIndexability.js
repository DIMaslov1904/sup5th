import { evaluateRobotsFile, indexingRulesFromMeta } from './seoRules.js'
import { normalizeAuditUrl } from './seoAuditLinks.js'
import { parseAuditExclusionRules, matchAuditExclusion } from './seoAuditExclusionRules.js'

export const createAuditIndexability = (siteUrl, { enabled = true, maxExcluded = 50000, customExclusions = '' } = {}) => {
    const origin = new URL(siteUrl).origin, excluded = new Map(), allowed = new Set()
    const custom = parseAuditExclusionRules(customExclusions)
    let robots = { pending: true }, limited = false
    const internal = url => new URL(url).origin === origin
    const record = (url, reason, details = {}) => {
        const existing = excluded.get(url)
        if (!existing && excluded.size >= maxExcluded) { limited = true; return false }
        const entry = existing || { url, reason, sources: [], sitemaps: [] }
        for (const field of ['sources', 'sitemaps']) entry[field] = [...new Set([...entry[field], ...(details[field] || [])])]
        if (details.source === 'links' && details.sourceUrl) entry.sources = [...new Set([...entry.sources, details.sourceUrl])]
        if (details.source === 'sitemap' && details.sourceUrl) entry.sitemaps = [...new Set([...entry.sitemaps, details.sourceUrl])]
        if (details.status) entry.status = details.status
        entry.current ||= details.current || details.source === 'current'
        excluded.set(url, entry); allowed.delete(url)
        return false
    }
    const beforeRequest = (value, details = {}) => {
        const url = normalizeAuditUrl(value)
        if (!url) return true
        if (excluded.has(url)) return record(url, excluded.get(url).reason, details)
        const customRule = matchAuditExclusion(custom, url)
        if (customRule) return record(url, `Свои исключения: ${customRule.directive}: ${customRule.value}`, details)
        if (!enabled || !internal(url)) return true
        if (robots.pending || allowed.has(url)) return true
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
        beforeRequest, afterResponse, has: url => excluded.has(url), hasCustomRules: custom.hasRules,
        setRobots: file => { robots = file; allowed.clear() },
        snapshot: () => ({ enabled, customExclusions: custom.text, limited, items: [...excluded.values()].map(item => ({ ...item, sources: [...item.sources], sitemaps: [...item.sitemaps] })) })
    }
}

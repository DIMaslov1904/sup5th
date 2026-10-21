const normalizeRobotsPath = value => String(value).replace(/%([\da-f]{2})|[^\x00-\x7F]/giu, (match, hex) => {
    if (!hex) return encodeURIComponent(match)
    const char = String.fromCharCode(parseInt(hex, 16))
    return /[a-z\d._~-]/i.test(char) ? char : '%' + hex.toUpperCase()
})
export const evaluateRobots = (content, pageUrl, agent = '*') => {
    const groups = []; let group = null, hasRules = false
    for (const raw of String(content || '').split(/\r?\n/)) {
        const line = raw.replace(/#.*/, '').trim(), colon = line.indexOf(':')
        if (colon < 0) continue
        const directive = line.slice(0, colon).trim().toLowerCase(), value = line.slice(colon + 1).trim()
        if (directive === 'user-agent') {
            if (!group || hasRules) { group = { agents: [], rules: [] }; groups.push(group); hasRules = false }
            group.agents.push(value.toLowerCase())
        } else if (group && ['allow', 'disallow'].includes(directive)) {
            hasRules = true; if (value) group.rules.push({ directive, value })
        }
    }
    const exact = groups.filter(g => g.agents.includes(agent.toLowerCase()))
    const selected = exact.length ? exact : groups.filter(g => g.agents.includes('*'))
    const url = new URL(pageUrl), path = normalizeRobotsPath(url.pathname + url.search)
    const rules = selected.flatMap(g => g.rules).map(rule => {
        const normalized = normalizeRobotsPath(rule.value), anchored = normalized.endsWith('$')
        const source = anchored ? normalized.slice(0, -1) : normalized
        const pattern = source.split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + (anchored ? '$' : '')
        return { ...rule, applies: new RegExp(`^${pattern}`).test(path), specificity: source.replace(/\*/g, '').replace(/%[\dA-F]{2}/g, 'x').length }
    }).filter(rule => rule.applies).sort((a, b) => b.specificity - a.specificity || (a.directive === 'allow' ? -1 : 1))
    return { allowed: rules[0]?.directive !== 'disallow', rules }
}

export const evaluateRobotsFile = (file, url, agent = '*') => {
    if (file.pending || file.failure) return { allowed: null, rules: [] }
    if ([404, 410].includes(file.status)) return { allowed: true, rules: [] }
    if (file.truncated || /^\s*(?:<!doctype\s+html|<html\b)/i.test(file.content || '')) return { allowed: null, rules: [] }
    if (file.exists) return evaluateRobots(file.content, url, agent)
    return { allowed: null, rules: [] }
}
const prohibitsIndexing = value => /(?:^|[\s,])(?:noindex|none)(?=$|[\s,])/i.test(value)
export const indexingRulesFromMeta = (tags, xRobots = '') => {
    const metas = tags.map(el => ({ agent: String(el.name || '').toLowerCase(), value: String(el.content || '').trim() }))
    const robots = metas.filter(item => item.agent === 'robots').map(item => item.value).join(', ')
    const headers = [], ambiguousScopes = new Set()
    const exactLines = Array.isArray(xRobots)
    for (const line of Array.isArray(xRobots) ? xRobots : [xRobots]) {
        let scope = '*'
        for (const part of String(line || '').split(',')) {
            const match = part.trim().match(/^([a-z\d_-]+)\s*:\s*(.*)$/i)
            if (match && !['unavailable_after', 'max-snippet', 'max-image-preview', 'max-video-preview'].includes(match[1].toLowerCase())) { scope = match[1].toLowerCase(); headers.push({ agent: scope, value: match[2] }) }
            else {
                headers.push({ agent: scope, value: part.trim() })
                // Fetch combines repeated fields. A trailing directive might have
                // belonged to a separate unscoped header before that combination.
                if (!exactLines && scope !== '*' && prohibitsIndexing(part)) ambiguousScopes.add(scope)
            }
        }
    }
    const headerRules = agent => headers.filter(item => item.agent === '*' || item.agent === agent).map(item => item.value).join(', ')
    const agents = ['googlebot', 'yandex'].map(agent => ({ agent, allowed: prohibitsIndexing([robots, ...metas.filter(item => item.agent === agent).map(item => item.value), headerRules(agent)].join(', ')) ? false : [...ambiguousScopes].some(scope => scope !== agent) ? null : true }))
    return { robots, robotsAllowed: !prohibitsIndexing(robots), xRobotsAllowed: prohibitsIndexing(headerRules('*')) ? false : ambiguousScopes.size ? null : true, indexingAgents: agents }
}
export const collectIndexingRules = (doc, xRobots = '') => indexingRulesFromMeta([...doc.querySelectorAll('meta[name]')].map(el => ({ name: el.name, content: el.content })), xRobots)

export const parseMetaHtml = (text) => {
    const doc = new DOMParser().parseFromString(text, 'text/html')
    return { title: doc.querySelector('title')?.textContent.trim() || '', description: doc.querySelector('meta[name="description" i]')?.content.trim() || '', indexingMeta: [...doc.querySelectorAll('meta[name]')].map(el => ({ name: el.name, content: el.content })) }
}

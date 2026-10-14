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
    if (file.exists) return evaluateRobots(file.content, url, agent)
    if ([404, 410].includes(file.status)) return { allowed: true, rules: [] }
    return { allowed: null, rules: [] }
}
const prohibitsIndexing = value => /(?:^|[\s,])(?:noindex|none)(?=$|[\s,])/i.test(value)
export const collectIndexingRules = (doc, xRobots = '') => {
    const metas = [...doc.querySelectorAll('meta[name]')].map(el => ({ agent: el.name.toLowerCase(), value: el.content.trim() }))
    const robots = metas.filter(item => item.agent === 'robots').map(item => item.value).join(', ')
    const headers = [], parts = xRobots.split(','); let scope = '*'
    for (const part of parts) {
        const match = part.trim().match(/^([a-z\d_-]+)\s*:\s*(.*)$/i)
        if (match && !['unavailable_after', 'max-snippet', 'max-image-preview', 'max-video-preview'].includes(match[1].toLowerCase())) { scope = match[1].toLowerCase(); headers.push({ agent: scope, value: match[2] }) }
        else headers.push({ agent: scope, value: part.trim() })
    }
    const headerRules = agent => headers.filter(item => item.agent === '*' || item.agent === agent).map(item => item.value).join(', ')
    const agents = ['googlebot', 'yandex'].map(agent => ({ agent, allowed: !prohibitsIndexing([robots, ...metas.filter(item => item.agent === agent).map(item => item.value), headerRules(agent)].join(', ')) }))
    return { robots, robotsAllowed: !prohibitsIndexing(robots), xRobotsAllowed: !prohibitsIndexing(headerRules('*')), indexingAgents: agents }
}

export const parseMetaHtml = (text) => {
    const doc = new DOMParser().parseFromString(text, 'text/html')
    return { title: doc.querySelector('title')?.textContent.trim() || '', description: doc.querySelector('meta[name="description" i]')?.content.trim() || '' }
}

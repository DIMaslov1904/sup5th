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
    const url = new URL(pageUrl), path = url.pathname + url.search
    const rules = selected.flatMap(g => g.rules).map(rule => {
        const pattern = rule.value.replace(/[.+?^{}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
        return { ...rule, applies: new RegExp(`^${pattern}`).test(path), specificity: rule.value.replace(/[*$]/g, '').length }
    }).filter(rule => rule.applies).sort((a, b) => b.specificity - a.specificity || (a.directive === 'allow' ? -1 : 1))
    return { allowed: rules[0]?.directive !== 'disallow', rules }
}

export const parseMetaHtml = (text) => {
    const doc = new DOMParser().parseFromString(text, 'text/html')
    return { title: doc.querySelector('title')?.textContent.trim() || '', description: doc.querySelector('meta[name="description" i]')?.content.trim() || '' }
}

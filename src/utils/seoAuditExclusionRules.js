import { evaluateRobotsFile } from './seoRules.js'

export const parseAuditExclusionRules = value => {
    const text = String(value || '').replace(/^\uFEFF/, '').trim()
    let hasRules = false
    for (const [index, raw] of text.split(/\r?\n/).entries()) {
        const line = raw.replace(/#.*/, '').trim()
        if (!line) continue
        const match = line.match(/^(user-agent|allow|disallow)\s*:\s*(.*)$/i)
        if (!match) throw new Error(`Свои исключения, строка ${index + 1}: используйте Allow:, Disallow: или User-agent:.`)
        const directive = match[1].toLowerCase(), path = match[2].trim()
        if (directive === 'user-agent' && !path) throw new Error(`Свои исключения, строка ${index + 1}: не указан User-agent.`)
        if (directive !== 'user-agent' && path) {
            if (!path.startsWith('/') && !path.startsWith('*')) throw new Error(`Свои исключения, строка ${index + 1}: укажите путь от / или шаблон с *.`)
            hasRules = true
        }
    }
    const first = text.split(/\r?\n/).map(line => line.replace(/#.*/, '').trim()).find(Boolean) || ''
    return { text, hasRules, content: /^user-agent\s*:/i.test(first) ? text : `User-agent: *\n${text}` }
}

export const createAuditExclusionMatcher = rules => {
    if (!rules.hasRules) return () => null
    const file = { exists: true, status: 200, content: rules.content }
    return url => {
        for (const agent of ['googlebot', 'yandex']) {
            const result = evaluateRobotsFile(file, url, agent)
            if (result.allowed === false) return result.rules[0]
        }
        return null
    }
}

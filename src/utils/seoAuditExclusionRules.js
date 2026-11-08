import { evaluateRobotsFile } from './seoRules.js'

export const AUDIT_EXCLUSION_LABELS = {
    customExclusions: 'Свои исключения',
    queryExclusions: 'GET-параметры',
    cmsExclusions: 'Пути CMS'
}

export const DEFAULT_AUDIT_EXCLUSIONS = {
    customExclusions: '',
    queryExclusions: ['limit=', 'sort=', 'order=', 'set_filter=', 'filter=', 'utm_*=', 'gclid=', 'yclid=', 'ysclid=', 'fbclid=']
        .flatMap(key => [`Disallow: /*?${key}`, `Disallow: /*?*&${key}`]).join('\n'),
    cmsExclusions: ['/bitrix/', '/admin/', '/wp-admin/', '/wp-login.php', '/xmlrpc.php', '/administrator/', '/administrator$']
        .map(path => `Disallow: ${path}`).join('\n')
}

export const parseAuditExclusionRules = (value, label = AUDIT_EXCLUSION_LABELS.customExclusions) => {
    const text = String(value || '').replace(/^\uFEFF/, '')
    let first = ''
    let hasRules = false
    for (const [index, raw] of text.split(/\r?\n/).entries()) {
        const line = raw.replace(/#.*/, '').trim()
        if (!line) continue
        first ||= line
        const location = `«${label}», строка ${index + 1}.`
        const match = line.match(/^(user-agent|allow|disallow)\s*:\s*(.*)$/i)
        if (!match) throw new Error(`${location} Используйте Allow:, Disallow: или User-agent:.`)
        const directive = match[1].toLowerCase(), path = match[2].trim()
        if (directive === 'user-agent' && !path) throw new Error(`${location} Укажите имя User-agent.`)
        if (directive !== 'user-agent' && path) {
            if (!path.startsWith('/') && !path.startsWith('*')) throw new Error(`${location} Укажите путь от / или шаблон с *.`)
            hasRules = true
        }
    }
    return { label, hasRules, content: /^user-agent\s*:/i.test(first) ? text : `User-agent: *\n${text}` }
}

export const parseAuditExclusionLists = lists => Object.entries(AUDIT_EXCLUSION_LABELS)
    .map(([key, label]) => parseAuditExclusionRules(lists[key], label))

export const createAuditExclusionMatcher = (...lists) => {
    const files = lists.filter(list => list.hasRules).map(({ content, label }) => ({ exists: true, status: 200, content, label }))
    return url => {
        for (const agent of ['googlebot', 'yandex']) {
            let best = null
            for (const file of files) {
                const [rule] = evaluateRobotsFile(file, url, agent).rules
                if (!rule) continue
                if (!best || rule.specificity > best.specificity || (rule.specificity === best.specificity && rule.directive === 'allow')) {
                    best = { ...rule, label: file.label }
                }
            }
            if (best?.directive === 'disallow') return best
        }
        return null
    }
}

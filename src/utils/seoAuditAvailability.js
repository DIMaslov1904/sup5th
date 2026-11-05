import { encodeAuditCsv } from './seoAuditCsv.js'
import { normalizeAuditUrl } from './seoAuditLinks.js'

export const AUDIT_AVAILABILITY_LABELS = { available: 'Доступна', unavailable: 'Недоступна', redirect: 'Редирект', unknown: 'Не удалось подтвердить' }

export const inspectAuditAvailability = (url, info) => {
    const status = info.status || 0
    const location = String(info.redirectUrl || info.headers?.location || '')
    const redirectUrl = normalizeAuditUrl(location, url)
    const redirected = [301, 302, 303, 307, 308].includes(status) || status >= 300 && status < 400 && Boolean(redirectUrl)
    const availability = redirected ? 'redirect' : status >= 200 && status < 300 ? 'available' : status >= 400 ? 'unavailable' : 'unknown'
    return {
        url, finalUrl: redirected && redirectUrl ? redirectUrl : url, redirectUrl: redirected ? redirectUrl : '',
        status, redirected, availability, location: redirected ? location : '', label: AUDIT_AVAILABILITY_LABELS[availability], method: 'HEAD', ok: availability === 'available',
        outcome: availability === 'available' ? 'ok' : availability === 'unavailable' ? status >= 500 ? 'server' : 'broken' : availability,
        ttfb: info.ttfb ?? null,
        response: { method: 'HEAD', status, ok: status >= 200 && status < 300, url, headers: info.headers || {},
            failure: info.failure, ttfb: info.ttfb ?? null, chain: info.chain || [] }
    }
}

export const auditAvailabilityCsv = results => encodeAuditCsv([
    ['URL', 'Метод', 'HTTP', 'Доступность', 'Куда ведёт редирект'],
    ...results.map(item => [item.url, 'HEAD', item.status || '', item.label, item.redirectUrl || item.location || ''])
])

import { siteKey, siteHref, parseSiteAddress, createAccessIndex } from './siteAddress.js'
export const CMS_PATHS = { UMI: 'admin/content/sitetree/', EzPro: 'ezpro/', Bitrix: 'bitrix/admin/#authorize', ABO: 'login.php', MODX: 'manager/', AdminLTE: 'admin/', Joomla: 'administrator/' }
export const CMS_ICONS = ['abo', 'adminlte', 'bitrix', 'cms', 'ezpro', 'joomla', 'modx', 'tilda', 'umi', 'wordpress', 'drupal', 'opencart']
export const normalizeHost = siteKey
export const findProjectByUrl = (projects, value) => {
    let target
    try { target = parseSiteAddress(value) } catch { return null }
    let match = null, length = -1
    for (const project of projects || []) {
        let candidate
        try { candidate = parseSiteAddress(project.url) } catch { continue }
        if (candidate.port !== target.port) continue
        if (candidate.hostname === target.hostname) return project
        if (target.hostname.endsWith('.' + candidate.hostname) && candidate.hostname.length > length) { match = project; length = candidate.hostname.length }
    }
    return match
}
export const findAccessesByUrl = (accesses, url) => createAccessIndex(accesses || [])(url)
export const CREATE_TICKET_PARAM = 'sup5th-create-ticket'
export const getTicketUrl = project => project?.ticketKey ? `https://support.5th.ru/published/personal.php?key=${encodeURIComponent(project.ticketKey)}&t=requests&${CREATE_TICKET_PARAM}=1` : ''
export const getAdminUrl = project => {
    if (project?.urlAdmin) return siteHref(project.urlAdmin)
    if (!project?.cms || project.cms === 'Нет') return ''
    if (project.cms === 'Tilda') return 'https://tilda.ru/login/'
    const base = siteHref(project.siteUrl || project.url)
    return base && CMS_PATHS[project.cms] ? new URL('/' + CMS_PATHS[project.cms], base).href : ''
}
export const getCmsIconPath = cms => {
    const icon = cms === 'Своя' ? 'cms' : String(cms || '').toLowerCase()
    return `/assets/icons/${CMS_ICONS.includes(icon) ? icon : 'cms'}.svg`
}

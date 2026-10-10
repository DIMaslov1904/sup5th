/**
 * Общие утилиты работы с проектами.
 * Используются в background, popup и других частях расширения.
 */

export const CMS_PATHS = {
    UMI: 'admin/content/sitetree/',
    EzPro: 'ezpro/',
    Bitrix: 'bitrix/admin/#authorize',
    ABO: 'login.php',
    MODX: 'manager/',
    AdminLTE: 'admin/',
    Joomla: 'administrator/'
}

export const CMS_ICONS = ['abo', 'adminlte', 'bitrix', 'cms', 'ezpro', 'joomla', 'modx', 'tilda', 'umi', 'wordpress', 'drupal', 'opencart']

/** Приводит значение к имени хоста в нижнем регистре. */
export const normalizeHost = (value) => {
    try {
        const candidate = String(value || '').trim()
        return new URL(candidate.includes('://') ? candidate : `https://${candidate}`).hostname.toLowerCase()
    } catch {
        return String(value || '').trim().replace(/^https?:\/\//i, '').split('/')[0].toLowerCase()
    }
}

/**
 * Сначала точный домен, затем ближайший родительский домен.
 * Порядок строк API не влияет на выбор отдельного проекта поддомена.
 */
export const findProjectByUrl = (projects, url) => {
    if (!url) return null
    const host = normalizeHost(url)
    let match = null
    let matchLength = -1
    for (const item of projects || []) {
        const projectHost = normalizeHost(item?.url)
        if (!projectHost) continue
        if (host === projectHost) return item
        if (host.endsWith(`.${projectHost}`) && projectHost.length > matchLength) {
            match = item
            matchLength = projectHost.length
        }
    }
    return match
}

/** Все записи точного домена либо ближайшего родителя, без смешивания доступов. */
export const findAccessesByUrl = (accesses, url) => {
    const match = findProjectByUrl(accesses, url)
    return match ? (accesses || []).filter((access) => normalizeHost(access.url) === normalizeHost(match.url)) : []
}

export const getTicketUrl = (project) => project?.ticketKey
    ? `https://support.5th.ru/published/personal.php?key=${encodeURIComponent(project.ticketKey)}&t=requests`
    : ''

/** Возвращает ссылку на панель администрирования проекта (без авторизации) */
export const getAdminUrl = (project) => {
    if (!project?.cms || project.cms === 'Нет') return ''
    if (project.cms === 'Tilda') return 'https://tilda.ru/login/'
    if (project.cms === 'Своя' || project.cms === 'WordPress') return project.urlAdmin ? `https://${project.urlAdmin}` : ''
    return CMS_PATHS[project.cms] ? `https://${project.url}/${CMS_PATHS[project.cms]}` : project.urlAdmin ? `https://${project.urlAdmin}` : ''
}

/** Возвращает путь к SVG-иконке CMS (относительно корня расширения) */
export const getCmsIconPath = (cms) => {
    const iconName = cms === 'Своя' ? 'cms' : String(cms || '').toLowerCase()
    return `/assets/icons/${CMS_ICONS.includes(iconName) ? iconName : 'cms'}.svg`
}

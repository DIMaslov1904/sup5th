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

/** Приводит значение к нормализованному имени хоста (без www, в нижнем регистре) */
export const normalizeHost = (value) => {
    try {
        return new URL(value).hostname.toLowerCase()
    } catch {
        return String(value || '').replace(/^https?:\/\//, '').split('/')[0].toLowerCase()
    }
}

/**
 * Находит проект по URL вкладки.
 * Если у проекта разрешены поддомены — учитываются и поддомены.
 */
export const findProjectByUrl = (projects, url) => {
    if (!url) return null
    const host = normalizeHost(url)
    return (projects || []).find((item) => {
        if (!item?.url) return false
        const projectHost = normalizeHost(item.url)
        return item.subdomain ? (host === projectHost || host.endsWith(`.${projectHost}`)) : host === projectHost
    }) || null
}

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

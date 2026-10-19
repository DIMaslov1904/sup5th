import {normalizeSiteRule, createAccessIndex} from '../utils/siteAddress.js'
import {publicAccess} from './credentialRecords.js'
const asText = (value) => (value == null ? '' : String(value).trim())

export const normalizeProject = (item) => {
    const value = Array.isArray(item)
        ? { name: item[0], url: item[1], manual: item[2], urlAdmin: item[3], cms: item[4], ticketKey: item[5], git: item[6] }
        : item || {}
    return {
        name: asText(value.name || value.title || value.project),
        ...normalizeSiteRule(value.url || value.site || value.domain),
        urlAdmin: asText(value.urlAdmin || value.adminUrl),
        cms: asText(value.cms) || 'Нет',
        manual: asText(value.manual),
        ticketKey: asText(value.ticketKey),
        git: asText(value.git)
    }
}

const normalizeAccess = (item) => {
    const value = Array.isArray(item)
        ? { name: item[0], url: item[1], login: item[2], password: item[3], ftpUrl: item[4], ftpLogin: item[5], ftpPassword: item[6] }
        : item || {}
    const logins = asText(value.login || value.username).split(/\r?\n/).map((entry) => entry.trim())
    const passwords = asText(value.password).split(/\r?\n/).map((entry) => entry.trim())
    const name = asText(value.name || value.title || value.project)
    const site = normalizeSiteRule(value.url || value.site || value.domain)
    const ftpValue = value.ftp && typeof value.ftp === 'object' ? value.ftp : {}
    const ftp = {
        url: asText(ftpValue.url || value.ftpUrl),
        login: asText(ftpValue.login || value.ftpLogin),
        password: asText(ftpValue.password || value.ftpPassword)
    }
    const count = Math.max(logins.length, passwords.length)

    const accesses = Array.from({ length: count }, (_, index) => ({
        name,
        ...site,
        login: logins[index] || '',
        password: passwords[index] || ''
    })).filter((access) => access.login || access.password)

    // FTP/SSH belongs to the source row, not to each multiline site account.
    if (ftp.url || ftp.login || ftp.password) {
        if (!accesses.length) accesses.push({ name, ...site, login: '', password: '' })
        accesses[0].ftp = ftp
    }
    return accesses
}

const normalizeService = item => {
    const value = Array.isArray(item) ? { name: item[0], url: item[1], login: item[2], password: item[3] } : item || {}
    if (![value.name, value.url, value.login, value.password].some((field) => asText(field))) return null
    const name = asText(value.name)
    const rawUrl = asText(value.url)
    if (!name || !rawUrl) throw new Error('В сервисе API должны быть указаны название и ссылка')
    let parsedUrl
    try {
        parsedUrl = new URL(rawUrl.includes(':') ? rawUrl : `https://${rawUrl}`)
    } catch {
        throw new Error(`Некорректная ссылка сервиса «${name}»`)
    }
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error(`Ссылка сервиса «${name}» должна использовать HTTP или HTTPS`)
    return {
        name,
        url: parsedUrl.href,
        login: asText(value.login),
        password: asText(value.password)
    }
}

export const normalizeAccessData = (result) => ({
    accesses: result.access.flatMap(normalizeAccess),
    services: result.services.map(normalizeService).filter(Boolean)
})

export const toPublicData = (data) => {
    const snapshot = data.lastSuccessfulData
    const findAccesses = createAccessIndex(snapshot.accesses)
    const projectsByUrl = new Map(snapshot.projects.filter((project) => project.url).map((project) => [project.url, project]))
    const explicitProjectUrls = new Set(projectsByUrl.keys())

    for (const access of snapshot.accesses) {
        if (!access.url || explicitProjectUrls.has(access.url)) continue
        if (!projectsByUrl.has(access.url)) {
            projectsByUrl.set(access.url, { name: access.name, url: access.url, siteUrl: access.siteUrl, includeSubdomains: access.includeSubdomains !== false, cms: 'Нет' })
        } else if (access.includeSubdomains !== false) {
            projectsByUrl.get(access.url).includeSubdomains = true
        }
    }

    return {
        ...data,
        lastSuccessfulData: {
            ...snapshot,
            projects: [...projectsByUrl.values()].map((project) => {
                const count = findAccesses(project.url).length
                return { ...project, hasAccess: count > 0, accessCount: count }
            }),
            accesses: snapshot.accesses.map(publicAccess)
        }
    }
}


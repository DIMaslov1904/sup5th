import {normalizeSiteRule, createAccessIndex} from '../utils/siteAddress.js'
import {publicAccess} from './credentialRecords.js'
import {panelRecordId, panelRecordUrl} from '../utils/apiSource.js'
import {projectKey} from '../utils/projectUtils.js'
const asText = (value) => (value == null ? '' : String(value).trim())

const panelProject = (item, panelBase) => {
    const id = panelBase && Array.isArray(item) && panelRecordId(item[7])
    return id ? { id, panelBase, panelUrl: panelRecordUrl(panelBase, item[8]) } : {}
}

export const normalizeProject = (item, panelBase) => {
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
        git: asText(value.git),
        ...panelProject(item, panelBase)
    }
}

const normalizeAccess = (item, panelBase) => {
    const value = Array.isArray(item)
        ? { name: item[0], url: item[1], login: item[2], password: item[3], ftpUrl: item[4], ftpLogin: item[5], ftpPassword: item[6] }
        : item || {}
    const logins = asText(value.login || value.username).split(/\r?\n/).map((entry) => entry.trim())
    const passwords = asText(value.password).split(/\r?\n/).map((entry) => entry.trim())
    const name = asText(value.name || value.title || value.project)
    const project = panelProject(item, panelBase)
    const site = { ...normalizeSiteRule(value.url || value.site || value.domain),
        ...(project.id ? { projectId: project.id, panelBase: project.panelBase, panelUrl: project.panelUrl } : {}) }
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

const normalizeService = (item, panelBase) => {
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
    const panelId = panelBase && Array.isArray(item) && panelRecordId(item[4])
    return {
        ...(panelId ? { id: `panel:${panelBase}:${panelId}`, panelId, panelUrl: panelRecordUrl(panelBase, item[5]) } : {}),
        name,
        url: parsedUrl.href,
        login: asText(value.login),
        password: asText(value.password)
    }
}

export const normalizeAccessData = (result, panelBase) => ({
    accesses: result.access.flatMap(item => normalizeAccess(item, panelBase)),
    services: result.services.map(item => normalizeService(item, panelBase)).filter(Boolean)
})

export const indexProjectAccesses = accesses => {
    const byId = Map.groupBy(accesses.filter(access => access.projectId), access => access.projectId)
    const byUrl = createAccessIndex(accesses.filter(access => !access.projectId))
    return project => project.id ? byId.get(project.id) || [] : byUrl(project.url)
}

export const catalogueProjects = snapshot => {
    const projects = new Map(snapshot.projects.filter(project => project.url).map(project => [projectKey(project), project]))
    const explicitKeys = new Set(projects.keys())
    const explicitUrls = new Set(snapshot.projects.map(project => project.url))

    for (const { projectId, panelBase, panelUrl, name, url, siteUrl, includeSubdomains } of snapshot.accesses) {
        const project = { name, url, siteUrl, includeSubdomains: includeSubdomains !== false, cms: 'Нет',
            ...(projectId ? { id: projectId, panelBase, panelUrl } : {}) }
        const key = projectKey(project)
        if (!url || explicitKeys.has(key) || (!projectId && explicitUrls.has(url))) continue
        if (!projects.has(key)) projects.set(key, project)
        else if (project.includeSubdomains) projects.get(key).includeSubdomains = true
    }

    return [...projects.values()]
}

export const toPublicData = data => {
    const snapshot = data.lastSuccessfulData
    const findAccesses = indexProjectAccesses(snapshot.accesses)
    return {
        ...data,
        lastSuccessfulData: {
            ...snapshot,
            projects: catalogueProjects(snapshot).map(project => ({ ...project, hasAccess: findAccesses(project).length > 0 })),
            accesses: snapshot.accesses.map(publicAccess)
        }
    }
}


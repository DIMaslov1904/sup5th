import authScript from '../content-script/index.js?script&iife'
import { AUTH_SESSIONS_KEY, SERVICES_KEY, getStoredData, storageGet, sessionGet, sessionSet, mutateStorage, currentGeneration, assertGeneration } from './storageRepository.js'
import { getSecurityConfig, getUnlockedKey, readCredentialVault, vaultRevision, assertVaultRevision } from './credentialVault.js'
import { findAccessesByUrl, getAdminUrl } from '../utils/projectUtils.js'
import { hasOrigin } from '../utils/hostPermissions.js'

export const getProjectAccessRecords = async (data, url, required = true) => {
    const records = findAccessesByUrl(data.lastSuccessfulData.accesses, url)
    const key = (await getSecurityConfig())?.enabled ? await getUnlockedKey({ required }) : null
    if (!key) return records
    const secrets = new Map((await readCredentialVault(key)).accesses.map(record => [record.id, record]))
    return records.map(record => ({ ...record, ...secrets.get(record.id) }))
}
const selectedAccess = async ({ url, accessId }) => {
    if (typeof accessId !== 'string' || !accessId) throw new Error('Доступ изменился. Откройте карточку заново.')
    const data = await getStoredData(), records = await getProjectAccessRecords(data, url)
    const access = records.find(record => record.id === accessId)
    if (!access) throw new Error('Доступ удалён или изменился. Обновите карточку проекта.')
    return { data, access }
}
export const getProjectDetails = async ({ url }) => {
    const expected = vaultRevision(), data = await getStoredData()
    const records = await getProjectAccessRecords(data, url, false)
    assertVaultRevision(expected)
    return { accesses: records.map(record => ({ ...record, password: undefined, ftp: undefined, hasLogin: Boolean(record.login),
        hasPassword: Boolean(record.password || record.hasPassword), hasFtp: Boolean(record.ftp?.url || record.hasFtp),
        ftpUrl: record.ftp?.url || record.ftpUrl || '', ftpHasLogin: Boolean(record.ftp?.login || record.ftpHasLogin), ftpHasPassword: Boolean(record.ftp?.password || record.ftpHasPassword) })) }
}
export const getProjectAccessField = async payload => {
    const expected = vaultRevision(), { access } = await selectedAccess(payload)
    if (!['login', 'password', 'ftpUrl', 'ftpLogin', 'ftpPassword'].includes(payload.field)) throw new Error('Неизвестное поле доступа')
    const value = payload.field.startsWith('ftp') ? access.ftp?.[{ ftpUrl: 'url', ftpLogin: 'login', ftpPassword: 'password' }[payload.field]] : access[payload.field]
    assertVaultRevision(expected)
    if (!value) throw new Error('Поле доступа не заполнено')
    return value
}
export const copyProjectAccessText = async payload => {
    const expected = vaultRevision(), { data, access } = await selectedAccess(payload)
    const project = data.lastSuccessfulData.projects.find(record => record.url === payload.url)
    if (!project || !access.login || !access.password) throw new Error('Логин или пароль отсутствует')
    assertVaultRevision(expected)
    return `Доступ: ${getAdminUrl(project) || project.siteUrl}\nЛогин: ${access.login}\nПароль: ${access.password}`
}
export const getServices = async () => (await storageGet(SERVICES_KEY, [])).map(({ password, ...record }) => ({ ...record, hasLogin: Boolean(record.login), hasPassword: Boolean(password || record.hasPassword) }))
export const getServiceField = async ({ id, field }) => {
    if (!['login', 'password'].includes(field)) throw new Error('Неизвестное поле сервиса')
    const expected = vaultRevision(), services = await storageGet(SERVICES_KEY, [])
    let service = services.find(record => record.id === id)
    if (!service) throw new Error('Сервис удалён или изменился')
    if ((await getSecurityConfig())?.enabled) {
        const secrets = (await readCredentialVault(await getUnlockedKey())).services
        service = { ...service, ...secrets.find(record => record.id === id) }
    }
    assertVaultRevision(expected)
    if (!service[field]) throw new Error('Поле сервиса не заполнено')
    return service[field]
}
export const startAdminAuth = async payload => {
    const generation = currentGeneration(), expected = vaultRevision(), { data, access } = await selectedAccess(payload)
    const project = data.lastSuccessfulData.projects.find(record => record.url === payload.url)
    if (!project || !access.login || !access.password) throw new Error('Проект или доступ не найден')
    const adminUrl = getAdminUrl(project)
    if (!adminUrl) throw new Error('Адрес админки не указан')
    if (!await hasOrigin(adminUrl)) throw new Error('Предоставьте доступ к сайту для автозаполнения')
    const parsed = new URL(adminUrl), tab = await chrome.tabs.create({ url: 'about:blank' })
    try {
        await mutateStorage(async () => {
            assertGeneration(generation); assertVaultRevision(expected)
            const sessions = Object.fromEntries(Object.entries(await sessionGet(AUTH_SESSIONS_KEY, {})).filter(([, session]) => session.expiresAt > Date.now()))
            // Keep references only. Password is read when a matching form is ready.
            sessions[tab.id] = { url: payload.url, accessId: access.id, cms: project.cms, targetOrigin: parsed.origin,
                targetPath: parsed.pathname.replace(/[^/]*$/, '') || '/', createdAt: Date.now(), expiresAt: Date.now() + 300000 }
            await sessionSet(AUTH_SESSIONS_KEY, sessions)
        })
        await chrome.tabs.update(tab.id, { url: adminUrl })
    } catch (error) { await chrome.tabs.remove(tab.id).catch(() => {}); throw error }
    return { started: true }
}
const matchingSession = async sender => {
    if (sender.id !== chrome.runtime.id || !Number.isInteger(sender.tab?.id) || sender.frameId !== 0) return null
    const sessions = await sessionGet(AUTH_SESSIONS_KEY, {}), auth = sessions[sender.tab.id]
    if (!auth) return null
    const url = new URL(sender.url)
    if (auth.expiresAt <= Date.now() || auth.targetOrigin !== url.origin || !url.pathname.startsWith(auth.targetPath)) return null
    if ((await getSecurityConfig())?.enabled && !await getUnlockedKey({ required: false })) return null
    return auth
}
export const authContext = async (_payload, sender) => Boolean(await matchingSession(sender))
export const consumePendingAdminAuth = (_payload, sender) => mutateStorage(async () => {
    const expected = vaultRevision(), auth = await matchingSession(sender)
    if (!auth) return null
    const { access } = await selectedAccess(auth)
    assertVaultRevision(expected)
    const sessions = await sessionGet(AUTH_SESSIONS_KEY, {})
    delete sessions[sender.tab.id]
    await sessionSet(AUTH_SESSIONS_KEY, sessions)
    return { login: access.login, password: access.password, cms: auth.cms, createdAt: auth.createdAt }
})
export const injectAuthForTab = async (tabId, url) => {
    const auth = (await sessionGet(AUTH_SESSIONS_KEY, {}))[tabId]
    if (!auth || auth.expiresAt <= Date.now() || !url?.startsWith(auth.targetOrigin + '/')) return
    await chrome.scripting.executeScript({ target: { tabId }, files: [authScript] })
}
export const forgetAuthTab = tabId => mutateStorage(async () => {
    const sessions = await sessionGet(AUTH_SESSIONS_KEY, {})
    if (!Object.hasOwn(sessions, tabId)) return
    delete sessions[tabId]
    await sessionSet(AUTH_SESSIONS_KEY, sessions)
})

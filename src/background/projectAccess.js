import { extensionApi } from '../platform/extensionApi.js'
import { injectExtensionScript } from '../platform/scriptInjection.js'
import authScript from '../content-script/index.js?script&iife'
import { AUTH_SESSIONS_KEY, SERVICES_KEY, getStoredData, storageGet, sessionGet, sessionSet, sessionEntries, mutateStorage, currentGeneration, assertGeneration } from './storageRepository.js'
import { getSecurityConfig, getUnlockedKey, readCredentialVault, vaultRevision, assertVaultRevision } from './credentialVault.js'
import { findAccessesByUrl, getAdminUrl } from '../utils/projectUtils.js'
import { hasOrigin } from '../utils/hostPermissions.js'
import { publicAccess, publicService } from './credentialRecords.js'
import { openTabWithSession } from './tabSession.js'

const getProjectAccessRecords = async (data, url, required = true) => {
    const records = findAccessesByUrl(data.lastSuccessfulData.accesses, url)
    const key = await getUnlockedKey({ required })
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
    return { accesses: records.map(publicAccess) }
}
const accessFields = ['login', 'password', 'ftpUrl', 'ftpLogin', 'ftpPassword']
const accessFieldValue = (access, field) => field.startsWith('ftp')
    ? access.ftp?.[{ ftpUrl: 'url', ftpLogin: 'login', ftpPassword: 'password' }[field]]
    : access[field]
// One vault read decrypts every requested field of the same access.
export const getProjectAccessFields = async ({ url, accessId, fields }) => {
    const expected = vaultRevision(), { access } = await selectedAccess({ url, accessId })
    if (!Array.isArray(fields) || !fields.length || fields.some(field => !accessFields.includes(field))) throw new Error('Неизвестное поле доступа')
    const values = Object.fromEntries(fields.map(field => [field, accessFieldValue(access, field)]))
    assertVaultRevision(expected)
    if (fields.some(field => !values[field])) throw new Error('Поле доступа не заполнено')
    return values
}
export const getProjectAccessField = async payload => (await getProjectAccessFields({ ...payload, fields: [payload.field] }))[payload.field]
export const copyProjectAccessText = async payload => {
    const expected = vaultRevision(), { data, access } = await selectedAccess(payload)
    const project = data.lastSuccessfulData.projects.find(record => record.url === payload.url)
    if (!project || !access.login || !access.password) throw new Error('Логин или пароль отсутствует')
    assertVaultRevision(expected)
    return `Доступ: ${getAdminUrl(project) || project.siteUrl}\nЛогин: ${access.login}\nПароль: ${access.password}`
}
export const getServices = async () => (await storageGet(SERVICES_KEY, [])).map(publicService)
const serviceFields = ['login', 'password']
// One vault read decrypts every requested field of the same service.
export const getServiceFields = async ({ id, fields }) => {
    if (!Array.isArray(fields) || !fields.length || fields.some(field => !serviceFields.includes(field))) throw new Error('Неизвестное поле сервиса')
    const expected = vaultRevision(), services = await storageGet(SERVICES_KEY, [])
    let service = services.find(record => record.id === id)
    if (!service) throw new Error('Сервис удалён или изменился')
    if ((await getSecurityConfig())?.enabled) {
        const secrets = (await readCredentialVault(await getUnlockedKey())).services
        service = { ...service, ...secrets.find(record => record.id === id) }
    }
    assertVaultRevision(expected)
    if (fields.some(field => !service[field])) throw new Error('Поле сервиса не заполнено')
    return Object.fromEntries(fields.map(field => [field, service[field]]))
}
export const getServiceField = async ({ id, field }) => (await getServiceFields({ id, fields: [field] }))[field]
export const startAdminAuth = async payload => {
    const generation = currentGeneration(), expected = vaultRevision(), { data, access } = await selectedAccess(payload)
    const project = data.lastSuccessfulData.projects.find(record => record.url === payload.url)
    if (!project || !access.login || !access.password) throw new Error('Проект или доступ не найден')
    const adminUrl = getAdminUrl(project)
    if (!adminUrl) throw new Error('Адрес админки не указан')
    if (!await hasOrigin(adminUrl)) throw new Error('Предоставьте доступ к сайту для автозаполнения')
    const parsed = new URL(adminUrl)
    await openTabWithSession(adminUrl, tabId => mutateStorage(async () => {
        assertGeneration(generation); assertVaultRevision(expected)
        const sessions = await sessionEntries(AUTH_SESSIONS_KEY)
        // Keep references only. Password is read when a matching form is ready.
        sessions[tabId] = { url: payload.url, accessId: access.id, cms: project.cms, targetOrigin: parsed.origin,
            targetPath: parsed.pathname.replace(/[^/]*$/, '') || '/', createdAt: Date.now(), expiresAt: Date.now() + 300000 }
        await sessionSet(AUTH_SESSIONS_KEY, sessions)
    }))
    return { started: true }
}
const matchingSession = async sender => {
    if (sender.id !== extensionApi.runtime.id || !Number.isInteger(sender.tab?.id) || sender.frameId !== 0) return null
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
    await injectExtensionScript(tabId, authScript)
}
export const forgetAuthTab = tabId => mutateStorage(async () => {
    const sessions = await sessionGet(AUTH_SESSIONS_KEY, {})
    if (!Object.hasOwn(sessions, tabId)) return
    delete sessions[tabId]
    await sessionSet(AUTH_SESSIONS_KEY, sessions)
})

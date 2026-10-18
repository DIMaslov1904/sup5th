import { extensionApi } from '../platform/extensionApi.js'
import { DATA_KEY, SERVICES_KEY, VAULT_KEY, ERRORS_KEY, storageGet, storageSet, storageSetMany, sessionGet, sessionSet, mutateStorage, getStoredData, currentGeneration, assertGeneration } from './storageRepository.js'
import { readApiSettings } from './apiSettings.js'
import { normalizeProject, normalizeAccessData } from './catalogueData.js'
import { getSecurityConfig, getUnlockedKey, readCredentialVault, publicAccess, publicService, accessSecret, vaultRevision, assertVaultRevision } from './credentialVault.js'
import { sealJson } from './credentialCrypto.js'
import { assignLocalIds, accessIdentity, serviceIdentity } from './recordIdentity.js'
import { apiAuthorizationError, classifyApiAuthorization } from './apiAuthorization.js'

export const PROJECTS_ALARM = 'weekly-projects-refresh'
export const REFRESH_PERIOD = 7 * 24 * 60 * 60000
export const REFRESH_JOB_KEY = 'dataRefreshJob'
let running = null, controller = null
export const getRefreshJob = () => sessionGet(REFRESH_JOB_KEY, { running: false, state: 'idle' })
export const cancelRefresh = () => { controller?.abort(); running = null }
export const logError = (type, error, generation) => mutateStorage(async () => {
    if (generation !== undefined) assertGeneration(generation)
    const entries = await storageGet(ERRORS_KEY, [])
    await storageSet(ERRORS_KEY, [{ type, message: error.message, createdAt: Date.now() }, ...entries].slice(0, 50))
})
export const requestRows = async (url, kind, signal) => {
    const timer = AbortSignal.timeout(30000)
    const response = await fetch(url, { headers: { Accept: 'application/json' }, credentials: 'include', redirect: 'follow', signal: signal ? AbortSignal.any([signal, timer]) : timer })
    const text = await response.text(), status = classifyApiAuthorization(response, text)
    if (status) throw apiAuthorizationError(status, kind)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    let payload
    try { payload = JSON.parse(text) } catch { throw new Error('Ответ API не является JSON') }
    if (payload?.error) throw new Error(String(payload.error))
    if (kind === 'доступов') {
        if (!Array.isArray(payload?.result?.access) || !Array.isArray(payload?.result?.services)) throw new Error('Ожидались массивы result.access и result.services')
        return payload.result
    }
    const rows = Array.isArray(payload) ? payload : payload?.result
    if (!Array.isArray(rows)) throw new Error('Ожидался массив result')
    return rows
}
const saveRows = (type, rows, url, generation, securityRevision) => mutateStorage(async () => {
    assertGeneration(generation)
    const data = await getStoredData(), snapshot = data.lastSuccessfulData
    let services = null, encryptedVault = null, values = rows
    if (type === 'accesses') {
        assertVaultRevision(securityRevision)
        const protectedMode = (await getSecurityConfig())?.enabled
        const key = protectedMode ? await getUnlockedKey() : null
        const vault = key ? await readCredentialVault(key) : null
        const previousSecrets = new Map(vault?.accesses.map(record => [record.id, record]) || [])
        const previousServices = await storageGet(SERVICES_KEY, [])
        const serviceSecrets = new Map(vault?.services.map(record => [record.id, record]) || [])
        values = assignLocalIds(rows.accesses, snapshot.accesses.map(record => ({ ...record, ...previousSecrets.get(record.id) })), accessIdentity)
        services = assignLocalIds(rows.services, previousServices.map(record => ({ ...record, ...serviceSecrets.get(record.id) })), serviceIdentity)
        if (key) {
            encryptedVault = await sealJson({ accesses: values.map(accessSecret), services: services.map(({ id, password }) => ({ id, password })) }, key)
            values = values.map(publicAccess)
            services = services.map(publicService)
        }
    }
    assertGeneration(generation)
    if (type === 'accesses') assertVaultRevision(securityRevision)
    const next = { ...data, lastSuccessfulData: { ...snapshot, [type]: values, [`${type}Url`]: url, [`${type}UpdatedAt`]: Date.now(), ...(services ? { servicesCount: services.length } : {}) } }
    await storageSetMany({ [DATA_KEY]: next, ...(services ? { [SERVICES_KEY]: services } : {}), ...(encryptedVault ? { [VAULT_KEY]: encryptedVault } : {}) })
})
export const refreshAll = ({ scope = 'all', onlyIfDue = false } = {}) => {
    if (!['all', 'projects', 'accesses'].includes(scope)) return Promise.reject(new Error('Неизвестный вид загрузки'))
    const generation = currentGeneration()
    if (running) return running.then(() => { assertGeneration(generation); return refreshAll({ scope, onlyIfDue: true }) })
    const requestController = new AbortController(), id = crypto.randomUUID()
    controller = requestController
    const work = (async () => {
        const settings = await readApiSettings(), data = await getStoredData()
        assertGeneration(generation)
        const locked = (await getSecurityConfig())?.enabled && !await getUnlockedKey({ required: false })
        const types = ['projects', 'accesses'].filter(type => {
            const url = settings[type === 'projects' ? 'projectsUrl' : 'accessUrl']
            if (!url || (scope !== 'all' && scope !== type)) return false
            const snapshot = data.lastSuccessfulData
            return !onlyIfDue || snapshot[`${type}Url`] !== url || Date.now() - (snapshot[`${type}UpdatedAt`] || 0) >= REFRESH_PERIOD
        })
        if (!types.length) {
            if (!settings.projectsUrl && !settings.accessUrl) throw new Error('Сначала сохраните адрес API')
            return { ...data, refreshed: {} }
        }
        const job = { id, running: true, state: 'loading', scope, startedAt: Date.now(), completed: 0, total: types.length, errors: [] }
        const publish = () => mutateStorage(async () => { assertGeneration(generation); await sessionSet(REFRESH_JOB_KEY, { ...job }) })
        await publish()
        const refreshed = {}, securityRevision = vaultRevision(), statuses = {}
        await Promise.all(types.map(async type => {
            try {
                if (type === 'accesses' && locked) throw new Error('Хранилище заблокировано. Разблокируйте его для загрузки доступов.')
                const url = settings[type === 'projects' ? 'projectsUrl' : 'accessUrl']
                const rows = await requestRows(url, type === 'projects' ? 'проектов' : 'доступов', requestController.signal)
                await saveRows(type, type === 'projects' ? rows.map(normalizeProject) : normalizeAccessData(rows), url, generation, securityRevision)
                refreshed[type] = true
                statuses[type] = ''
            } catch (error) {
                assertGeneration(generation)
                if (requestController.signal.aborted) throw error
                statuses[type] = error.apiStatus || ''
                job.errors.push(`${type === 'projects' ? 'Проекты' : 'Доступы'}: ${error.message}`)
                await logError(type, error, generation)
            } finally {
                job.completed++
                if (generation === currentGeneration()) await publish()
            }
        }))
        return mutateStorage(async () => {
            assertGeneration(generation)
            const saved = await getStoredData()
            const next = { ...saved, refreshErrors: job.errors,
                ...(statuses.projects !== undefined ? { projectApiStatus: statuses.projects } : {}),
                ...(statuses.accesses !== undefined ? { accessApiStatus: statuses.accesses, accessAuthRequired: ['login_required', 'authorization_needed'].includes(statuses.accesses) } : {}) }
            await storageSet(DATA_KEY, next)
            await sessionSet(REFRESH_JOB_KEY, { ...job, running: false, state: job.errors.length ? 'error' : 'done', finishedAt: Date.now() })
            return { ...next, refreshed }
        })
    })().catch(async error => {
        if (generation === currentGeneration()) await mutateStorage(async () => {
            assertGeneration(generation)
            const job = await getRefreshJob()
            if (job.id === id) await sessionSet(REFRESH_JOB_KEY, { ...job, running: false, state: 'error', finishedAt: Date.now(), errors: [...job.errors, error.message] })
        })
        throw error
    })
    running = work
    work.finally(() => { if (running === work) { running = null; controller = null } }).catch(() => {})
    return work
}
export const scheduleRefresh = async () => {
    const settings = await readApiSettings()
    if (!settings.projectsUrl && !settings.accessUrl) return extensionApi.alarms.clear(PROJECTS_ALARM)
    if (!await extensionApi.alarms.get(PROJECTS_ALARM)) await extensionApi.alarms.create(PROJECTS_ALARM, { delayInMinutes: REFRESH_PERIOD / 60000, periodInMinutes: REFRESH_PERIOD / 60000 })
}

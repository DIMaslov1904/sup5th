import { extensionApi } from '../platform/extensionApi.js'
import { DATA_KEY, SERVICES_KEY, VAULT_KEY, ERRORS_KEY, REFRESH_JOB_KEY, storageGet, storageSet, storageSetMany, sessionGet, sessionSet, mutateStorage, getStoredData, currentGeneration, assertGeneration } from './storageRepository.js'
import { readApiSettings, readStoredApiSettings } from './apiSettings.js'
import { normalizeProject, normalizeAccessData } from './catalogueData.js'
import { getSecurityConfig, getUnlockedKey, readCredentialVault, vaultRevision, assertVaultRevision } from './credentialVault.js'
import { publicAccess, publicService, accessSecret } from './credentialRecords.js'
import { openJson, sealJson } from '../utils/credentialCrypto.js'
import { apiUrls, panelRecordId } from '../utils/apiSource.js'
import { assignLocalIds, accessIdentity, serviceIdentity } from './recordIdentity.js'
import { apiAuthorizationError, classifyApiAuthorization } from './apiAuthorization.js'
import { REFRESH_PERIOD } from '../utils/dataRefreshPolicy.js'
import { ensureAlarm } from '../platform/alarms.js'

export const PROJECTS_ALARM = 'projects-refresh'
let running = null
export const getRefreshJob = () => sessionGet(REFRESH_JOB_KEY, { running: false, state: 'idle' })
export const saveRefreshJob = job => sessionSet(REFRESH_JOB_KEY, job)
export const cancelRefresh = () => { running?.controller.abort(); running = null }
const logError = (type, error, generation) => mutateStorage(async () => {
    if (generation !== undefined) assertGeneration(generation)
    const entries = await storageGet(ERRORS_KEY, [])
    await storageSet(ERRORS_KEY, [{ type, message: error.message, createdAt: Date.now() }, ...entries].slice(0, 50))
})
const requestRows = async (url, kind, signal, token) => {
    const timer = AbortSignal.timeout(30000)
    const response = await fetch(url, {
        headers: { Accept: 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
        credentials: token ? 'omit' : 'include', redirect: token ? 'error' : 'follow',
        ...(token ? { cache: 'no-store' } : {}), signal: AbortSignal.any([signal, timer])
    })
    if (token && response.status === 401) throw new Error('Панель отклонила токен. Создайте новую строку подключения в разделе SUP 5th профиля панели.')
    if (token && response.status === 404) {
        if (kind === 'внимания') return []
        throw new Error('API панели не найден. Проверьте адрес панели.')
    }
    const text = await response.text()
    if (!token) {
        const status = classifyApiAuthorization(response, text)
        if (status) throw apiAuthorizationError(status, kind)
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    let payload
    try { payload = JSON.parse(text) } catch { throw new Error('Ответ API не является JSON') }
    if (payload?.error) throw new Error(token ? 'Панель сообщила об ошибке API' : String(payload.error))
    if (kind === 'доступов') {
        if (!Array.isArray(payload?.result?.access) || !Array.isArray(payload?.result?.services)) throw new Error('Ожидались массивы result.access и result.services')
        return payload.result
    }
    const rows = Array.isArray(payload) ? payload : payload?.result
    if (!Array.isArray(rows)) throw new Error('Ожидался массив result')
    return rows
}
export const loadPanelAttention = async () => {
    const generation = currentGeneration(), securityRevision = vaultRevision()
    const { panelToken, ...settings } = await readStoredApiSettings()
    const url = apiUrls(settings, Boolean(panelToken)).attention
    if (!url) return { status: 'ready', rows: [] }
    const key = typeof panelToken === 'string' ? null : await getUnlockedKey({ required: false })
    assertGeneration(generation)
    assertVaultRevision(securityRevision)
    if (typeof panelToken !== 'string' && !key) return { status: 'locked', rows: [] }
    const token = key ? await openJson(panelToken, key) : panelToken
    assertGeneration(generation)
    assertVaultRevision(securityRevision)
    const rows = await requestRows(url, 'внимания', new AbortController().signal, token)
    assertGeneration(generation)
    assertVaultRevision(securityRevision)
    return { status: 'ready', rows: rows.filter(row => panelRecordId(row?.project_id)
        && typeof row.kind === 'string' && typeof row.color === 'string' && typeof row.name === 'string' && typeof row.detail === 'string') }
}

const saveRows = (type, rows, url, generation, securityRevision, panelBase) => mutateStorage(async () => {
    assertGeneration(generation)
    const data = await getStoredData(), snapshot = data.lastSuccessfulData
    let services = null, encryptedVault = null, values = rows
    if (type === 'accesses') {
        assertVaultRevision(securityRevision)
        const key = await getUnlockedKey()
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
    const next = { ...data, lastSuccessfulData: { ...snapshot, [type]: values, [`${type}Url`]: url, [`${type}UpdatedAt`]: Date.now(),
        ...(panelBase ? { [`${type}PanelMetadata`]: true } : {}) } }
    await storageSetMany({ [DATA_KEY]: next, ...(services ? { [SERVICES_KEY]: services } : {}), ...(encryptedVault ? { [VAULT_KEY]: encryptedVault } : {}) })
})
export const refreshAll = async ({ scope = 'all', onlyIfDue = false } = {}) => {
    if (!['all', 'projects', 'accesses'].includes(scope)) throw new Error('Неизвестный вид загрузки')
    const generation = currentGeneration()
    if (running?.generation === generation) {
        await running.work
        assertGeneration(generation)
        return refreshAll({ scope, onlyIfDue: true })
    }
    cancelRefresh()
    const requestController = new AbortController(), id = crypto.randomUUID()
    const work = (async () => {
        const { panelToken, ...settings } = await readStoredApiSettings(), data = await getStoredData()
        const urls = apiUrls(settings, Boolean(panelToken)), panel = settings.source === 'panel'
        assertGeneration(generation)
        const securityRevision = vaultRevision()
        const locked = (await getSecurityConfig())?.enabled && !await getUnlockedKey({ required: false })
        const types = ['projects', 'accesses'].filter(type => {
            const url = urls[type]
            if (!url || (scope !== 'all' && scope !== type)) return false
            const snapshot = data.lastSuccessfulData
            return !onlyIfDue || snapshot[`${type}Url`] !== url || (panel && !snapshot[`${type}PanelMetadata`]) || Date.now() - (snapshot[`${type}UpdatedAt`] || 0) >= REFRESH_PERIOD
        })
        if (!types.length) {
            if (!urls.projects && !urls.accesses) throw new Error(panel
                ? 'Сначала сохраните строку подключения' : 'Сначала сохраните адрес API')
            return { ...data, refreshed: {} }
        }
        if (panel && locked) {
            if (onlyIfDue) return { ...data, refreshed: {} }
            throw new Error('Разблокируйте хранилище для загрузки данных из панели.')
        }
        const token = !panel ? '' : typeof panelToken === 'string' ? panelToken : await openJson(panelToken, await getUnlockedKey())
        if (panel) assertVaultRevision(securityRevision)
        const job = { id, running: true, state: 'loading', completed: 0, total: types.length, errors: [] }
        const publish = () => mutateStorage(async () => { assertGeneration(generation); await saveRefreshJob({ ...job }) })
        await publish()
        const refreshed = {}, statuses = {}
        await Promise.all(types.map(async type => {
            try {
                if (type === 'accesses' && locked) throw new Error('Хранилище заблокировано. Разблокируйте его для загрузки доступов.')
                const url = urls[type]
                assertGeneration(generation)
                if (panel) assertVaultRevision(securityRevision)
                const rows = await requestRows(url, type === 'projects' ? 'проектов' : 'доступов', requestController.signal, token)
                const panelBase = panel ? settings.panelUrl : ''
                const values = type === 'projects' ? rows.map(item => normalizeProject(item, panelBase)) : normalizeAccessData(rows, panelBase)
                await saveRows(type, values, url, generation, securityRevision, panelBase)
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
            await saveRefreshJob({ ...job, running: false, state: job.errors.length ? 'error' : 'done', finishedAt: Date.now() })
            return { ...next, refreshed }
        })
    })().catch(async error => {
        if (generation === currentGeneration()) await mutateStorage(async () => {
            assertGeneration(generation)
            const job = await getRefreshJob()
            if (job.id === id) await saveRefreshJob({ ...job, running: false, state: 'error', finishedAt: Date.now(), errors: [...job.errors, error.message] })
        })
        throw error
    })
    running = { work, generation, controller: requestController }
    work.finally(() => { if (running?.work === work) running = null }).catch(() => {})
    return work
}
export const scheduleRefresh = async () => {
    const urls = apiUrls(await readApiSettings())
    if (!urls.projects && !urls.accesses) return extensionApi.alarms.clear(PROJECTS_ALARM)
    const periodInMinutes = REFRESH_PERIOD / 60000
    await ensureAlarm(extensionApi.alarms, PROJECTS_ALARM, { delayInMinutes: periodInMinutes, periodInMinutes })
}

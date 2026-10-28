import { extensionApi } from '../platform/extensionApi.js'
import { trustedLocal, restrictStorageAccess } from '../platform/trustedStorage.js'
import { createSessionWriter } from '../utils/sessionQuota.js'
export const SCHEMA_VERSION = 1
export const DATA_KEY = 'projectData'
export const SERVICES_KEY = 'services'
export const SETTINGS_KEY = 'apiSettings'
export const ERRORS_KEY = 'apiErrorLog'
export const SECURITY_KEY = 'credentialSecurity'
export const VAULT_KEY = 'credentialVault'
export const UNLOCKED_KEY = 'unlockedCredentialVaultKey'
export const AUTH_SESSIONS_KEY = 'pendingAdminAuthSessions'

export const emptyData = () => ({
    projectApiStatus: '', accessApiStatus: '', accessAuthRequired: false, refreshErrors: [],
    lastSuccessfulData: { projects: [], accesses: [], servicesCount: 0, projectsUpdatedAt: null, accessesUpdatedAt: null, projectsUrl: '', accessesUrl: '' }
})

// No legacy readers or migrations: incompatible data must be imported again.
export const storageReady = (async () => {
    await restrictStorageAccess()
    const saved = await trustedLocal.get('schemaVersion')
    if (saved.schemaVersion === SCHEMA_VERSION) return false
    await trustedLocal.clear()
    await extensionApi.storage.session.clear()
    await trustedLocal.set({ schemaVersion: SCHEMA_VERSION })
    return true
})()

export const storageGet = async (key, fallback = null) => { await storageReady; return (await trustedLocal.get(key))[key] ?? fallback }
export const storageSetMany = async values => { await storageReady; await trustedLocal.set(values) }
export const storageSet = (key, value) => storageSetMany({ [key]: value })
export const sessionGet = async (key, fallback = null) => { await storageReady; return (await extensionApi.storage.session.get(key))[key] ?? fallback }
const writeSession = createSessionWriter(extensionApi?.storage.session)
export const sessionSet = async (key, value) => { await storageReady; await writeSession({ [key]: value }) }
export const sessionRemove = async key => { await storageReady; await extensionApi.storage.session.remove(key) }
export const getStoredData = () => storageGet(DATA_KEY, emptyData())

let pending = Promise.resolve(), generation = 0
export const mutateStorage = action => {
    const result = pending.then(() => storageReady).then(action)
    pending = result.catch(() => {})
    return result
}
export const currentGeneration = () => generation
export const invalidateOperations = () => ++generation
export const assertGeneration = expected => {
    if (expected !== generation) throw new Error('Операция отменена: данные были сброшены')
}

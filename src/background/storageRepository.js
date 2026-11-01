import { extensionApi } from '../platform/extensionApi.js'
import { trustedLocal, restrictStorageAccess } from '../platform/trustedStorage.js'
import { createSessionWriter } from '../utils/sessionQuota.js'
import { createSerialQueue } from '../utils/serialQueue.js'
export const SCHEMA_VERSION = 1
export const DATA_KEY = 'projectData'
export const SERVICES_KEY = 'services'
export const SETTINGS_KEY = 'apiSettings'
export const ERRORS_KEY = 'apiErrorLog'
export const SECURITY_KEY = 'credentialSecurity'
export const VAULT_KEY = 'credentialVault'
export const UNLOCKED_KEY = 'unlockedCredentialVaultKey'
export const AUTH_SESSIONS_KEY = 'pendingAdminAuthSessions'

const emptyData = () => ({
    projectApiStatus: '', accessApiStatus: '', accessAuthRequired: false, refreshErrors: [],
    lastSuccessfulData: { projects: [], accesses: [], projectsUpdatedAt: null, accessesUpdatedAt: null, projectsUrl: '', accessesUrl: '' }
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
/** Drops expired entries from a session map; `keepWithoutExpiry` keeps entries without a deadline. */
export const pruneExpiredSessions = (entries, { keepWithoutExpiry = false } = {}) => Object.fromEntries(
    Object.entries(entries).filter(([, entry]) => (keepWithoutExpiry && !entry.expiresAt) || entry.expiresAt > Date.now()))
/** Reads a session map and drops expired entries. */
export const sessionEntries = async (key, options) => pruneExpiredSessions(await sessionGet(key, {}), options)
export const getStoredData = () => storageGet(DATA_KEY, emptyData())

let generation = 0
const enqueueMutation = createSerialQueue()
export const mutateStorage = action => enqueueMutation(() => storageReady.then(action))
export const currentGeneration = () => generation
export const invalidateOperations = () => ++generation
export const assertGeneration = expected => {
    if (expected !== generation) throw new Error('Операция отменена: данные были сброшены')
}

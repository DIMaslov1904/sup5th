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
    await Promise.all([
        chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }),
        chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' })
    ])
    const saved = await chrome.storage.local.get('schemaVersion')
    if (saved.schemaVersion === SCHEMA_VERSION) return false
    await chrome.storage.local.clear()
    await chrome.storage.session.clear()
    await chrome.storage.local.set({ schemaVersion: SCHEMA_VERSION })
    return true
})()

export const storageGet = async (key, fallback = null) => { await storageReady; return (await chrome.storage.local.get(key))[key] ?? fallback }
export const storageSetMany = async values => { await storageReady; await chrome.storage.local.set(values) }
export const storageSet = (key, value) => storageSetMany({ [key]: value })
export const sessionGet = async (key, fallback = null) => { await storageReady; return (await chrome.storage.session.get(key))[key] ?? fallback }
export const sessionSet = async (key, value) => { await storageReady; await chrome.storage.session.set({ [key]: value }) }
export const sessionRemove = async key => { await storageReady; await chrome.storage.session.remove(key) }
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

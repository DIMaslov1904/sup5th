import { base64ToBytes, bytesToBase64, importAesKey, openJson, sealJson } from './credentialCrypto.js'
import { publicAccess, publicService, accessSecret } from './credentialRecords.js'
export { publicAccess, publicService, accessSecret } from './credentialRecords.js'
import { DATA_KEY, SERVICES_KEY, SECURITY_KEY, VAULT_KEY, UNLOCKED_KEY, AUTH_SESSIONS_KEY, getStoredData, storageGet, storageSetMany, sessionGet, sessionSet, sessionRemove, mutateStorage } from './storageRepository.js'

let revision = 0
export const vaultRevision = () => revision
export const assertVaultRevision = expected => { if (expected !== revision) throw new Error('Хранилище было заблокировано. Повторите действие.') }
export const getSecurityConfig = () => storageGet(SECURITY_KEY)
export const getUnlockedKey = async ({ required = true } = {}) => {
    if (!(await getSecurityConfig())?.enabled) return null
    const session = await sessionGet(UNLOCKED_KEY)
    if (session?.key) return importAesKey(base64ToBytes(session.key))
    if (required) throw new Error('Хранилище заблокировано. Подтвердите вход биометрией устройства.')
    return null
}
export const readCredentialVault = async key => {
    const vault = await storageGet(VAULT_KEY)
    if (!vault) throw new Error('Хранилище не найдено. Загрузите доступы заново.')
    return openJson(vault, key)
}
export const getSecurityStatus = async () => {
    const config = await getSecurityConfig()
    return config?.enabled ? { ...config, unlocked: Boolean((await sessionGet(UNLOCKED_KEY))?.key) } : { enabled: false, mode: 'off', unlocked: true }
}
export const enableHelloProtection = payload => mutateStorage(async () => {
    if ((await getSecurityConfig())?.enabled) throw new Error('Защита уже включена')
    const { rawVaultKey, credentialId, prfSalt, wrappedKey } = payload
    if (typeof rawVaultKey !== 'string' || base64ToBytes(rawVaultKey).length !== 32 || !credentialId ||
        base64ToBytes(prfSalt || '').length !== 32 || !wrappedKey?.iv || !wrappedKey?.ciphertext) throw new Error('Некорректные параметры биометрии')
    const data = await getStoredData(), services = await storageGet(SERVICES_KEY, [])
    const key = await importAesKey(base64ToBytes(rawVaultKey))
    const vault = { accesses: data.lastSuccessfulData.accesses.map(accessSecret), services: services.map(({ id, password }) => ({ id, password })) }
    const config = { enabled: true, mode: 'hello', credentialId, prfSalt, wrappedKey, createdAt: Date.now() }
    await sessionRemove(AUTH_SESSIONS_KEY)
    await storageSetMany({
        [DATA_KEY]: { ...data, lastSuccessfulData: { ...data.lastSuccessfulData, accesses: data.lastSuccessfulData.accesses.map(publicAccess) } },
        [SERVICES_KEY]: services.map(publicService), [SECURITY_KEY]: config, [VAULT_KEY]: await sealJson(vault, key)
    })
    await sessionSet(UNLOCKED_KEY, { key: rawVaultKey })
    return getSecurityStatus()
})
export const unlockWithHelloKey = async ({ key }) => {
    const expected = revision
    if (!(await getSecurityConfig())?.enabled || typeof key !== 'string' || base64ToBytes(key).length !== 32) throw new Error('Биометрия не настроена или ключ повреждён')
    await readCredentialVault(await importAesKey(base64ToBytes(key)))
    return mutateStorage(async () => {
        assertVaultRevision(expected)
        await sessionSet(UNLOCKED_KEY, { key })
        return getSecurityStatus()
    })
}
export const lockCredentialVault = async () => {
    revision++ // Invalidate operations before waiting for the storage queue.
    await mutateStorage(async () => {
        const sessions = await sessionGet(AUTH_SESSIONS_KEY, {})
        await sessionRemove([UNLOCKED_KEY, AUTH_SESSIONS_KEY])
        await Promise.allSettled(Object.keys(sessions).map(id => chrome.tabs.sendMessage(Number(id), { type: 'auth:cancel' })))
    })
    return getSecurityStatus()
}
export const disableCredentialProtection = () => mutateStorage(async () => {
    const key = await getUnlockedKey(), expected = revision
    if (!key) return getSecurityStatus()
    const vault = await readCredentialVault(key), data = await getStoredData(), services = await storageGet(SERVICES_KEY, [])
    const secrets = new Map(vault.accesses.map(record => [record.id, record]))
    const serviceSecrets = new Map(vault.services.map(record => [record.id, record]))
    const restore = (record, index) => {
        const secret = index.get(record.id)
        if (!secret) throw new Error('Секрет не найден. Защита сохранена.')
        return { ...record, ...secret }
    }
    const accesses = data.lastSuccessfulData.accesses.map(record => restore(record, secrets))
    const restoredServices = services.map(record => restore(record, serviceSecrets))
    assertVaultRevision(expected)
    await storageSetMany({ [DATA_KEY]: { ...data, lastSuccessfulData: { ...data.lastSuccessfulData, accesses } }, [SERVICES_KEY]: restoredServices })
    await chrome.storage.local.remove([SECURITY_KEY, VAULT_KEY])
    await sessionRemove([UNLOCKED_KEY, AUTH_SESSIONS_KEY])
    return getSecurityStatus()
})

export const registerVaultIdleLock = () => {
    chrome.idle.setDetectionInterval(600)
    chrome.idle.onStateChanged.addListener(state => {
        if (state !== 'active') lockCredentialVault().catch(error => console.error('[vault] idle lock', error))
    })
    chrome.idle.queryState(600).then(state => {
        if (state !== 'active') return lockCredentialVault()
    }).catch(error => console.error('[vault] idle state', error))
}

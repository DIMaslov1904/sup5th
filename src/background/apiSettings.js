import { SETTINGS_KEY, DATA_KEY, SERVICES_KEY, AUTH_SESSIONS_KEY, REFRESH_JOB_KEY, storageGet, storageSetMany, sessionRemove, mutateStorage, emptyData, invalidateOperations } from './storageRepository.js'
import { getUnlockedKey, vaultRevision, assertVaultRevision, invalidateVaultReads } from './credentialVault.js'
import { sealJson } from '../utils/credentialCrypto.js'
import { API_SOURCES, parsePanelConnection } from '../utils/apiSource.js'
import { SETUP_STEPS } from '../utils/setupProgress.js'

export const readStoredApiSettings = async () => ({
    source: 'google', projectsUrl: '', accessUrl: '', panelUrl: '', ...await storageGet(SETTINGS_KEY, {})
})
const publicSettings = ({ panelToken, ...settings }) => ({ ...settings, panelTokenSaved: Boolean(panelToken) })
export const readApiSettings = async () => publicSettings(await readStoredApiSettings())

export const saveApiSettings = patch => mutateStorage(async () => {
    const previous = await readStoredApiSettings(), next = { ...previous }
    if (patch.source !== undefined) {
        if (!API_SOURCES.some(([source]) => source === patch.source)) throw new Error('Неизвестный источник данных')
        next.source = patch.source
    }
    for (const field of ['projectsUrl', 'accessUrl']) {
        if (patch[field] === undefined) continue
        const value = String(patch[field]).trim()
        if (value) {
            const url = new URL(value)
            if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Некорректный URL API')
        }
        next[field] = value
    }
    if (patch.panelConnection !== undefined) {
        const { panelUrl, panelToken } = parsePanelConnection(patch.panelConnection)
        const revision = vaultRevision(), key = await getUnlockedKey()
        next.panelUrl = panelUrl
        next.panelToken = key ? await sealJson(panelToken, key) : panelToken
        assertVaultRevision(revision)
    }
    if (patch.setupStep !== undefined) {
        if (!SETUP_STEPS.includes(patch.setupStep)) throw new Error('Неизвестный шаг настройки')
        next.setupStep = patch.setupStep
    }
    const connectionChanged = next.source !== previous.source ||
        (next.source === 'panel' && (next.panelUrl !== previous.panelUrl || next.panelToken !== previous.panelToken))
    const values = { [SETTINGS_KEY]: next }
    if (connectionChanged) {
        await sessionRemove([AUTH_SESSIONS_KEY, REFRESH_JOB_KEY])
        values[DATA_KEY] = emptyData()
        values[SERVICES_KEY] = []
    }
    await storageSetMany(values)
    if (connectionChanged) {
        // A sealed vault remains available for key verification until the next access download.
        invalidateOperations()
        invalidateVaultReads()
    }
    return publicSettings(next)
})

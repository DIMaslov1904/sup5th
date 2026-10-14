import { ref } from 'vue'
import { getCredentialSecurityStatus, loadRefreshJob } from './data/projectData.js'

export const securityStatus = ref({ enabled: false, unlocked: true, ready: false })
export const refreshJob = ref({ running: false, state: 'idle' })
let securityRevision = 0
export const refreshSecurityStatus = async () => {
    const revision = ++securityRevision, value = await getCredentialSecurityStatus()
    if (revision === securityRevision) securityStatus.value = { ...value, ready: true }
}
export const connectBackgroundState = () => {
    let disposed = false, jobRevision = 0
    const update = async (changes, area) => {
        if (disposed) return
        if (!changes || changes.credentialSecurity || changes.unlockedCredentialVaultKey) {
            await refreshSecurityStatus()
        }
        if (!changes || (area === 'session' && changes.dataRefreshJob)) {
            const revision = ++jobRevision, value = await loadRefreshJob()
            if (!disposed && revision === jobRevision) refreshJob.value = value
        }
    }
    const listener = (changes, area) => update(changes, area).catch(console.error)
    chrome.storage.onChanged.addListener(listener)
    update().catch(console.error)
    return () => { disposed = true; chrome.storage.onChanged.removeListener(listener) }
}

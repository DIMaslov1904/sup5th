import { reactive, readonly } from 'vue'
import { extensionApi } from '../platform/extensionApi.js'
import { createPipelineBadgeSession } from './pipelineBadgeSession.js'
import { loadPipelineAbsence, savePipelineAbsence } from './data/projectData.js'

const key = 'pipelineBadgeEnabled'
const state = reactive({ enabled: false, ready: false })
let revision = 0
extensionApi.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[key]) return
    revision++
    state.enabled = changes[key].newValue === true
})
const current = revision
extensionApi.storage.local.get(key).then(saved => {
    if (current === revision) state.enabled = saved[key] === true
}).catch(() => {}).finally(() => { state.ready = true })

export const pipelineBadgePreference = readonly(state)
export const setPipelineBadgeEnabled = async enabled => {
    await extensionApi.storage.local.set({ [key]: enabled === true })
    state.enabled = enabled === true
}
export const pipelineBadgeSession = createPipelineBadgeSession(fetch, () => state.enabled, {
    get: loadPipelineAbsence,
    set: savePipelineAbsence
})

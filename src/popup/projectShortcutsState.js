import { readonly, shallowRef } from 'vue'
import { extensionApi } from '../platform/extensionApi.js'
import { loadProjectShortcuts, saveProjectShortcuts } from './data/projectData.js'
import { PROJECT_SHORTCUTS_KEY, normalizeProjectShortcuts } from '../utils/projectShortcuts.js'
const state = shallowRef(normalizeProjectShortcuts(null))
let revision = 0, loading
const load = () => {
    const current = ++revision
    loading = loadProjectShortcuts().then(value => { if (current === revision) state.value = value }).catch(() => {})
    return loading
}
extensionApi.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes[PROJECT_SHORTCUTS_KEY]) load() })
load()
export const projectShortcuts = readonly(state)
export const updateProjectShortcuts = async patch => {
    await loading
    const current = ++revision
    const value = await saveProjectShortcuts(patch)
    if (current === revision) state.value = value
    return value
}
export const recordProjectOpen = async url => {
    await loading
    if (state.value.enabled) return updateProjectShortcuts({ kind: 'visit', url })
}

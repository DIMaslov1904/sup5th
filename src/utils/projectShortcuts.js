import { siteKey } from './siteAddress.js'
import { findProjectByKey, projectKey } from './projectUtils.js'
const normalizeKey = key => typeof key === 'string' && key.startsWith('panel:') ? key : siteKey(key)
export const PROJECT_SHORTCUTS_KEY = 'projectShortcuts'
export const PROJECT_SHORTCUTS_LIMIT = 7
/** @typedef {{enabled: boolean, pinned: string[], recent: string[]}} ProjectShortcutState */
export const normalizeProjectShortcuts = value => ({
    enabled: value?.enabled === true,
    pinned: [...new Set((Array.isArray(value?.pinned) ? value.pinned : []).map(normalizeKey).filter(Boolean))].slice(0, PROJECT_SHORTCUTS_LIMIT),
    recent: value?.enabled === true
        ? [...new Set((Array.isArray(value?.recent) ? value.recent : []).map(normalizeKey).filter(Boolean))].slice(0, PROJECT_SHORTCUTS_LIMIT)
        : []
})
export const selectProjectShortcuts = (projects, value) => {
    const state = normalizeProjectShortcuts(value)
    const items = [...state.pinned, ...state.recent].map(key => findProjectByKey(projects, key)).filter(Boolean)
    return [...new Set(items)].slice(0, PROJECT_SHORTCUTS_LIMIT)
        .map(project => ({ ...project, pinned: state.pinned.some(key => findProjectByKey(projects, key) === project) }))
}

export const changeProjectShortcuts = (value, patch, projects) => {
    const state = normalizeProjectShortcuts(value)
    const currentKeys = entries => [...new Set(entries.map(key => findProjectByKey(projects, key)).filter(Boolean).map(projectKey))]
    const pinned = currentKeys(state.pinned), recent = currentKeys(state.recent)
    if (patch.kind === 'configure') {
        return normalizeProjectShortcuts({ ...state, enabled: patch.enabled === undefined ? state.enabled : patch.enabled === true, pinned, recent })
    }
    if (patch.kind === 'visit' && !state.enabled) return state
    const project = findProjectByKey(projects, normalizeKey(patch.url))
    if (!project) throw new Error('Проект больше не доступен в каталоге')
    const url = projectKey(project)
    if (patch.kind === 'visit') return { ...state, pinned, recent: [url, ...recent.filter(item => item !== url)].slice(0, PROJECT_SHORTCUTS_LIMIT) }
    if (patch.kind === 'pin') {
        if (patch.pinned && !pinned.includes(url) && pinned.length >= PROJECT_SHORTCUTS_LIMIT) throw new Error('Можно закрепить до 7 проектов. Уберите один из избранных.')
        return { ...state, recent, pinned: patch.pinned ? [...new Set([...pinned, url])] : pinned.filter(item => item !== url) }
    }
    throw new Error('Неизвестное действие с проектом')
}

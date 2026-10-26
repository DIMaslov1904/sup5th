import { siteKey } from './siteAddress.js'
export const PROJECT_SHORTCUTS_KEY = 'projectShortcuts'
export const PROJECT_SHORTCUTS_LIMIT = 7
/** @typedef {{enabled: boolean, pinned: string[], recent: string[]}} ProjectShortcutState */
export const normalizeProjectShortcuts = value => ({
    enabled: value?.enabled === true,
    pinned: [...new Set((Array.isArray(value?.pinned) ? value.pinned : []).map(siteKey).filter(Boolean))].slice(0, PROJECT_SHORTCUTS_LIMIT),
    // Migrate the old popularity log once, preserving the latest visit per project.
    recent: value?.enabled === true ? [...new Set((Array.isArray(value?.recent) ? value.recent :
        (Array.isArray(value?.visits) ? [...value.visits].filter(event => event && Number.isFinite(event.at))
            .reverse().sort((a, b) => b.at - a.at).map(event => event.url) : []))
        .map(siteKey).filter(Boolean))].slice(0, PROJECT_SHORTCUTS_LIMIT) : []
})
export const selectProjectShortcuts = (projects, value) => {
    const state = normalizeProjectShortcuts(value)
    const byUrl = new Map(projects.map(project => [siteKey(project.url), project]))
    return [...new Set([...state.pinned, ...state.recent])].filter(url => byUrl.has(url)).slice(0, PROJECT_SHORTCUTS_LIMIT)
        .map(url => ({ ...byUrl.get(url), pinned: state.pinned.includes(url) }))
}
export const changeProjectShortcuts = (value, patch, projects) => {
    const state = normalizeProjectShortcuts(value), known = new Set(projects.map(project => siteKey(project.url)))
    const pinned = state.pinned.filter(url => known.has(url)), recent = state.recent.filter(url => known.has(url))
    if (patch.kind === 'configure') {
        return normalizeProjectShortcuts({ ...state, enabled: patch.enabled === undefined ? state.enabled : patch.enabled === true, pinned, recent })
    }
    if (patch.kind === 'visit' && !state.enabled) return state
    const url = siteKey(patch.url)
    if (!known.has(url)) throw new Error('Проект больше не доступен в каталоге')
    if (patch.kind === 'visit') return { ...state, pinned, recent: [url, ...recent.filter(item => item !== url)].slice(0, PROJECT_SHORTCUTS_LIMIT) }
    if (patch.kind === 'pin') {
        if (patch.pinned && !pinned.includes(url) && pinned.length >= PROJECT_SHORTCUTS_LIMIT) throw new Error('Можно закрепить до 7 проектов. Уберите один из избранных.')
        return { ...state, recent, pinned: patch.pinned ? [...new Set([...pinned, url])] : pinned.filter(item => item !== url) }
    }
    throw new Error('Неизвестное действие с проектом')
}

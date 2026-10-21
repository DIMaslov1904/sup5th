import { siteKey } from './siteAddress.js'
export const PROJECT_SHORTCUTS_KEY = 'projectShortcuts'
export const PROJECT_SHORTCUTS_LIMIT = 7
export const PROJECT_POPULAR_WINDOW = 2 * 86400000
/** @typedef {{enabled: boolean, pinned: string[], visits: Array<{url: string, at: number}>}} ProjectShortcutState */
export const normalizeProjectShortcuts = (value, now = Date.now()) => ({
    enabled: value?.enabled === true,
    pinned: [...new Set((Array.isArray(value?.pinned) ? value.pinned : []).map(siteKey).filter(Boolean))].slice(0, PROJECT_SHORTCUTS_LIMIT),
    // Legacy recent entries have no timestamps and cannot prove popularity.
    visits: value?.enabled === true && Array.isArray(value?.visits) ? value.visits
        .filter(event => event && Number.isFinite(event.at) && event.at > now - PROJECT_POPULAR_WINDOW && event.at <= now)
        .map(event => ({ url: siteKey(event.url), at: event.at })).filter(event => event.url) : []
})
export const selectProjectShortcuts = (projects, value, now = Date.now()) => {
    const state = normalizeProjectShortcuts(value, now), counts = new Map()
    const byUrl = new Map(projects.map(project => [siteKey(project.url), project]))
    for (const { url, at } of state.visits) {
        const item = counts.get(url) || { url, count: 0, latest: 0 }
        item.count++; item.latest = Math.max(item.latest, at); counts.set(url, item)
    }
    const popular = [...counts.values()].filter(item => item.count >= 2)
        .sort((a, b) => b.count - a.count || b.latest - a.latest || a.url.localeCompare(b.url)).map(item => item.url)
    return [...new Set([...state.pinned, ...popular])].filter(url => byUrl.has(url)).slice(0, PROJECT_SHORTCUTS_LIMIT)
        .map(url => ({ ...byUrl.get(url), pinned: state.pinned.includes(url) }))
}
export const changeProjectShortcuts = (value, patch, projects, now = Date.now()) => {
    const state = normalizeProjectShortcuts(value, now), known = new Set(projects.map(project => siteKey(project.url)))
    const pinned = state.pinned.filter(url => known.has(url)), visits = state.visits.filter(event => known.has(event.url))
    if (patch.kind === 'configure') {
        return normalizeProjectShortcuts({ ...state, enabled: patch.enabled === undefined ? state.enabled : patch.enabled === true, pinned, visits }, now)
    }
    if (patch.kind === 'visit' && !state.enabled) return state
    const url = siteKey(patch.url)
    if (!known.has(url)) throw new Error('Проект больше не доступен в каталоге')
    if (patch.kind === 'visit') return { ...state, pinned, visits: [...visits, { url, at: now }] }
    if (patch.kind === 'pin') {
        if (patch.pinned && !pinned.includes(url) && pinned.length >= PROJECT_SHORTCUTS_LIMIT) throw new Error('Можно закрепить до 7 проектов. Уберите один из избранных.')
        return { ...state, visits, pinned: patch.pinned ? [...new Set([...pinned, url])] : pinned.filter(item => item !== url) }
    }
    throw new Error('Неизвестное действие с проектом')
}

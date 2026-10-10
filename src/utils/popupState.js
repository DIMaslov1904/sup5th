export const POPUP_STATE_KEY = 'popupUiState'
export const POPUP_PORT_NAME = 'popup-ui-state'
export const POPUP_RETENTION_MS = 15000

export const defaultPopupState = () => ({ view: 'site', projectUrl: '', serviceId: '' })

export const normalizePopupState = (state) => ({
    view: ['site', 'projects', 'settings'].includes(state?.view) ? state.view : 'site',
    projectUrl: state?.view === 'projects' && typeof state.projectUrl === 'string' ? state.projectUrl : '',
    serviceId: state?.view === 'projects' && typeof state.serviceId === 'string' ? state.serviceId : ''
})

export const closedPopupState = (state, closedAt = Date.now()) => {
    const current = normalizePopupState(state)
    if (!(current.view === 'projects' && (current.projectUrl || current.serviceId))) return null
    return { ...current, expiresAt: closedAt + POPUP_RETENTION_MS }
}

export const restorePopupState = (saved, now = Date.now()) => {
    if (!Number.isFinite(saved?.expiresAt) || saved.expiresAt <= now) return defaultPopupState()
    const retained = closedPopupState(saved, now)
    return retained ? normalizePopupState(saved) : defaultPopupState()
}

export type SetupStep = 'intro' | 'security' | 'projects' | 'accesses' | 'done'

export interface ApiSettings {
    source: 'google' | 'panel'
    projectsUrl: string
    accessUrl: string
    panelUrl: string
    panelTokenSaved: boolean
    setupStep?: SetupStep
}

export interface RefreshOptions {
    scope?: 'all' | 'projects' | 'accesses'
    onlyIfDue?: boolean
}

export interface ActiveSupportTicket {
    ticketId: string
    startedAt: number
    source: 'log' | 'click' | 'observed'
}

export interface SupportTrackingState {
    active?: ActiveSupportTicket | null
    dismissed?: string[]
}

export type AccessField = 'login' | 'password' | 'ftpUrl' | 'ftpLogin' | 'ftpPassword'
export type ServiceField = 'login' | 'password'

export type RuntimeResponse<T> = { ok: true; data: T } | { ok: false; error: string }

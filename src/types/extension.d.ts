export type SetupStep = 'projects' | 'security' | 'accesses' | 'done'

export interface ApiSettings {
    projectsUrl: string
    accessUrl: string
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

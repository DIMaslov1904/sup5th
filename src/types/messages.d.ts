import type { ActiveSupportTicket, ApiSettings } from './extension.js'

// Responses without a model stay unknown until their modules are typed.
export interface PopupResults {
    'updates:status': import('../updates/checker.js').UpdateStatus
    'updates:check': import('../updates/checker.js').UpdateStatus
    'data:settings:get': ApiSettings
    'data:settings:set': ApiSettings
    'support:ticket:get': ActiveSupportTicket | null
    'support:ticket:reset': null
    'data:projects:get': unknown
    'data:projects:authorize': { opened: boolean }
    'data:accesses:authorize': { opened: boolean }
    'data:all:refresh': unknown
    'data:errors:get': { type: string; message: string; createdAt: number }[]
    'data:errors:clear': void
    'data:clear': { cleared: boolean }
    'data:job:get': unknown
    'icons:status': unknown
    'icons:refresh': unknown
    'icons:cancel': unknown
    'auth:start': { started: boolean }
    'services:get': unknown
    'services:field': string
    'project:copyAccess': string
    'project:details': unknown
    'project:accessField': string
    'security:status': unknown
    'security:enableHello': unknown
    'security:unlockHelloKey': unknown
    'security:lock': unknown
    'security:disable': unknown
}

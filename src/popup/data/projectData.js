// @ts-check
import { callBackground } from '../../utils/backgroundClient.js'

export const loadApiSettings = () => callBackground('data:settings:get')
/** @param {string} repository */
export const loadPipelineAbsence = repository => callBackground('pipeline:absence:get', { repository })
/** @param {string} repository @param {boolean} missing */
export const savePipelineAbsence = (repository, missing) => callBackground('pipeline:absence:set', { repository, missing })
export const loadProjectShortcuts = () => callBackground('shortcuts:get')
/** @param {object} patch */
export const saveProjectShortcuts = patch => callBackground('shortcuts:update', patch)
export const loadUpdateStatus = () => callBackground('updates:status')
export const checkExtensionUpdate = () => callBackground('updates:check')
export const loadActiveSupportTicket = () => callBackground('support:ticket:get')
export const resetActiveSupportTicket = () => callBackground('support:ticket:reset')

/** @param {Partial<Pick<import('../../types/extension.js').ApiSettings, 'source' | 'projectsUrl' | 'accessUrl' | 'setupStep'>> & { panelConnection?: string }} patch */
export const saveApiSettings = (patch) =>
    callBackground('data:settings:set', patch)

export const loadPanelAttention = () => callBackground('data:attention:get')

export const loadProjectData = () => callBackground('data:projects:get')

export const authorizeAccessApi = () => callBackground('data:accesses:authorize')
export const authorizeProjectsApi = () => callBackground('data:projects:authorize')

/** @param {import('../../types/extension.js').RefreshOptions} [options] */
export const refreshAll = (options = {}) =>
    callBackground('data:all:refresh', options)

export const loadErrorLog = () => callBackground('data:errors:get')
export const clearErrorLog = () => callBackground('data:errors:clear')

export const clearAllData = () => callBackground('data:clear')
export const loadIconStatus = () => callBackground('icons:status')
export const refreshSiteIcons = () => callBackground('icons:refresh')
/** @param {string} url */
export const refreshSiteIcon = url => callBackground('icons:refreshOne', { url })
export const cancelSiteIcons = () => callBackground('icons:cancel')

/** @param {string} projectKey @param {string} accessId */
export const startAdminAuth = (projectKey, accessId) => callBackground('auth:start', { projectKey, accessId })

export const loadServices = () => callBackground('services:get')

/** @param {string} id @param {import('../../types/extension.js').ServiceField} field */
export const getServiceField = (id, field) => callBackground('services:field', { id, field })

/** @param {string} projectKey @param {string} accessId */
export const getProjectAccessText = (projectKey, accessId) =>
    callBackground('project:copyAccess', { projectKey, accessId })

/** @param {string} projectKey */
export const loadProjectDetails = projectKey =>
    callBackground('project:details', { projectKey })

/** @param {string} projectKey @param {string} accessId @param {import('../../types/extension.js').AccessField} field */
export const getProjectAccessField = (projectKey, accessId, field) =>
    callBackground('project:accessField', { projectKey, accessId, field })

/** @param {string} projectKey @param {string} accessId @param {import('../../types/extension.js').AccessField[]} fields */
export const getProjectAccessFields = (projectKey, accessId, fields) =>
    callBackground('project:accessFields', { projectKey, accessId, fields })

export const getCredentialSecurityStatus = () => callBackground('security:status')

/** @param {Awaited<ReturnType<typeof import('../../utils/biometricHello.js').enableBiometricProtectionFlow>>} payload */
export const enableHelloProtection = (payload) => callBackground('security:enableHello', payload)

/** @param {string} pin */
export const enablePinProtection = (pin) => callBackground('security:enablePin', { pin })

/** @param {string} key @param {{ refreshAfterUnlock?: boolean }} [options] */
export const unlockCredentialVaultWithHello = (key, { refreshAfterUnlock = true } = {}) => callBackground('security:unlockHelloKey', { key, refreshAfterUnlock })

/** @param {string} pin @param {{ refreshAfterUnlock?: boolean }} [options] */
export const unlockCredentialVaultWithPin = (pin, { refreshAfterUnlock = true } = {}) => callBackground('security:unlockPin', { pin, refreshAfterUnlock })

export const lockCredentialVault = () => callBackground('security:lock')

export const disableCredentialProtection = () => callBackground('security:disable')

export const loadRefreshJob = () => callBackground("data:job:get")

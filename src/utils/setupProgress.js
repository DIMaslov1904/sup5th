// @ts-check

/** @type {import('../types/extension.js').SetupStep[]} */
export const SETUP_STEPS = ['projects', 'security', 'accesses', 'done']
/** @param {import('../types/extension.js').ApiSettings} settings */
export const resolveSetupStep = settings => !settings.projectsUrl ? 'projects' : settings.setupStep && SETUP_STEPS.includes(settings.setupStep) ? settings.setupStep : 'done'

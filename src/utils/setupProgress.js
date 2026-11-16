// @ts-check

/** @type {import('../types/extension.js').SetupStep[]} */
export const SETUP_STEPS = ['security', 'projects', 'accesses', 'done']
/** @param {import('../types/extension.js').ApiSettings} settings */
export const resolveSetupStep = settings => settings.setupStep && SETUP_STEPS.includes(settings.setupStep) ? settings.setupStep
    : (settings.source === 'panel' ? settings.panelUrl && settings.panelTokenSaved : settings.projectsUrl) ? 'done' : 'intro'

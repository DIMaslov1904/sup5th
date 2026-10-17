export const SETUP_STEPS = ['projects', 'security', 'accesses', 'done']
export const resolveSetupStep = settings => !settings.projectsUrl ? 'projects' : SETUP_STEPS.includes(settings.setupStep) ? settings.setupStep : 'done'

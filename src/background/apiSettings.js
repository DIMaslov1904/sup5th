import { SETTINGS_KEY, storageGet, storageSet, mutateStorage } from './storageRepository.js'
import { SETUP_STEPS } from '../utils/setupProgress.js'

export const readApiSettings = () => storageGet(SETTINGS_KEY, { projectsUrl: '', accessUrl: '' })
export const saveApiSettings = patch => mutateStorage(async () => {
    const next = { ...await readApiSettings() }
    for (const field of ['projectsUrl', 'accessUrl']) {
        if (patch[field] === undefined) continue
        const value = String(patch[field]).trim()
        if (value) {
            const url = new URL(value)
            if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Некорректный URL API')
        }
        next[field] = value
    }
    if (patch.setupStep !== undefined) {
        if (!SETUP_STEPS.includes(patch.setupStep)) throw new Error('Неизвестный шаг настройки')
        if (patch.setupStep !== 'projects' && !next.projectsUrl) throw new Error('Сначала подключите API проектов')
        next.setupStep = patch.setupStep
    }
    await storageSet(SETTINGS_KEY, next)
    return next
})

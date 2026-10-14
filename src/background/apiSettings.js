import { SETTINGS_KEY, storageGet, storageSet, mutateStorage } from './storageRepository.js'

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
    await storageSet(SETTINGS_KEY, next)
    return next
})

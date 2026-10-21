import { storageGet, storageSet, mutateStorage, getStoredData } from './storageRepository.js'
import { toPublicData } from './catalogueData.js'
import { PROJECT_SHORTCUTS_KEY, normalizeProjectShortcuts, changeProjectShortcuts } from '../utils/projectShortcuts.js'
export const getProjectShortcuts = async () => normalizeProjectShortcuts(await storageGet(PROJECT_SHORTCUTS_KEY))
export const updateProjectShortcuts = patch => mutateStorage(async () => {
    const state = await getProjectShortcuts()
    const data = await getStoredData()
    const next = changeProjectShortcuts(state, patch, toPublicData(data).lastSuccessfulData.projects)
    await storageSet(PROJECT_SHORTCUTS_KEY, next)
    return next
})

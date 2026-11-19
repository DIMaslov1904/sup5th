import { storageGet, storageSet, mutateStorage, getStoredData } from './storageRepository.js'
import { catalogueProjects } from './catalogueData.js'
import { PROJECT_SHORTCUTS_KEY, changeProjectShortcuts } from '../utils/projectShortcuts.js'
const readShortcuts = async patch => {
    const [state, data] = await Promise.all([storageGet(PROJECT_SHORTCUTS_KEY), getStoredData()])
    return changeProjectShortcuts(state, patch, catalogueProjects(data.lastSuccessfulData))
}
export const getProjectShortcuts = () => readShortcuts({ kind: 'configure' })
export const updateProjectShortcuts = patch => mutateStorage(async () => {
    const next = await readShortcuts(patch)
    await storageSet(PROJECT_SHORTCUTS_KEY, next)
    return next
})

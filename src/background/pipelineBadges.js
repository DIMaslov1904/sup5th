import { storageGet, storageSet, mutateStorage } from './storageRepository.js'
import { getPipelineLinks } from '../utils/pipelineLinks.js'
const key = 'missingPipelineRepositories'
export const getPipelineAbsence = async ({ repository }) => {
    const normalized = getPipelineLinks(repository)?.repository
    return Boolean(normalized && (await storageGet(key, [])).includes(normalized))
}
export const setPipelineAbsence = ({ repository, missing }) => mutateStorage(async () => {
    const normalized = getPipelineLinks(repository)?.repository
    if (!normalized) throw new Error('Некорректный адрес репозитория')
    const saved = new Set(await storageGet(key, []))
    if (missing === true) saved.add(normalized)
    else saved.delete(normalized)
    await storageSet(key, [...saved])
    return missing === true
})

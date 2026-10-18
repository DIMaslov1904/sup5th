// @ts-check
import { extensionApi } from '../platform/extensionApi.js'

/** @param {string | URL} value */
export const originPattern = value => {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Требуется HTTP или HTTPS адрес')
    return `${url.protocol}//${url.hostname}/*`
}
/** @param {string | URL} url */
export const hasOrigin = url => extensionApi.permissions.contains({ origins: [originPattern(url)] })

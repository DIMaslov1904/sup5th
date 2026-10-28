import { extensionApi, isFirefox } from './extensionApi.js'

// Firefox cannot restrict storage.local to trusted extension contexts. Keep the
// actual records in extension-origin IndexedDB; storage.local carries revisions
// only, so existing onChanged listeners never expose values to content scripts.
let database
const openDatabase = () => {
    if (!location.href.startsWith(extensionApi.runtime.getURL(''))) throw new Error('Хранилище доступно только страницам расширения')
    if (!database) database = new Promise((resolve, reject) => {
        const request = indexedDB.open('sup5th-private-data', 1)
        request.onupgradeneeded = () => request.result.createObjectStore('records')
        request.onsuccess = () => {
            request.result.onversionchange = () => { request.result.close(); database = null }
            resolve(request.result)
        }
        request.onerror = () => { database = null; reject(request.error) }
    })
    return database
}
const transact = async (mode, action) => {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('records', mode)
        let result
        const request = action(transaction.objectStore('records'))
        if (request) request.onsuccess = () => { result = request.result }
        transaction.oncomplete = () => resolve(result)
        transaction.onerror = () => reject(transaction.error)
        transaction.onabort = () => reject(transaction.error || new Error('Запись хранилища прервана'))
    })
}
const notify = keys => keys.length ? extensionApi.storage.local.set(Object.fromEntries(keys.map(key => [key, { revision: crypto.randomUUID() }]))) : Promise.resolve()
const privateLocal = {
    get: async key => ({ [key]: await transact('readonly', store => store.get(key)) }),
    set: async values => {
        await transact('readwrite', store => { for (const [key, value] of Object.entries(values)) store.put(value, key) })
        await notify(Object.keys(values))
    },
    remove: async keys => {
        const list = Array.isArray(keys) ? keys : [keys]
        await transact('readwrite', store => { for (const key of list) store.delete(key) })
        await notify(list)
    },
    clear: async () => {
        await transact('readwrite', store => store.clear())
        await extensionApi.storage.local.clear()
    }
}
export const trustedLocal = isFirefox ? privateLocal : extensionApi?.storage.local
export const restrictStorageAccess = async () => {
    if (isFirefox) return // session is trusted-only by default; local records use IndexedDB.
    await Promise.all([
        extensionApi.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }),
        extensionApi.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' })
    ])
}

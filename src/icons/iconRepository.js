import { ICON_CACHE_LIMIT } from './iconPolicy.js'

let database
const openDatabase = () => {
    if (database) return database
    database = new Promise((resolve, reject) => {
        const request = indexedDB.open('sup5th-site-icons', 1)
        request.onupgradeneeded = () => {
            request.result.createObjectStore('icons', { keyPath: 'origin' })
            request.result.createObjectStore('state')
        }
        request.onsuccess = () => {
            request.result.onversionchange = () => { request.result.close(); database = null }
            resolve(request.result)
        }
        request.onerror = () => { database = null; reject(request.error) }
    })
    return database
}

const transact = async (storeName, mode, operation) => {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, mode)
        const request = operation(transaction.objectStore(storeName))
        transaction.oncomplete = () => resolve(request?.result)
        transaction.onabort = () => reject(transaction.error || new Error('Не удалось сохранить кеш иконок'))
        transaction.onerror = () => reject(transaction.error)
    })
}

export const iconRepository = {
    get: origin => transact('icons', 'readonly', store => store.get(origin)),
    list: () => transact('icons', 'readonly', store => store.getAll()),
    getState: () => transact('state', 'readonly', store => store.get('queue')),
    setState: state => transact('state', 'readwrite', store => store.put(state, 'queue')),
    getNextRequestAt: () => transact('state', 'readonly', store => store.get('nextRequestAt')),
    setNextRequestAt: value => transact('state', 'readwrite', store => store.put(value, 'nextRequestAt')),
    remove: origin => transact('icons', 'readwrite', store => store.delete(origin)),
    put: async record => {
        const records = await iconRepository.list()
        const previous = records.find(item => item.origin === record.origin)
        const size = records.reduce((sum, item) => sum + (item.image?.size || 0), 0) - (previous?.image?.size || 0) + (record.image?.size || 0)
        if (size > ICON_CACHE_LIMIT) throw new Error('Кеш иконок достиг лимита 50 МБ')
        await transact('icons', 'readwrite', store => store.put(record))
    },
    clear: async () => {
        await transact('icons', 'readwrite', store => store.clear())
        await transact('state', 'readwrite', store => store.clear())
    }
}

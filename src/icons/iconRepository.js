
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
    put: record => transact('icons', 'readwrite', store => store.put(record)),
    warningSeen: () => transact('state', 'readonly', store => store.get('largeWarningSeen')),
    markWarningSeen: () => transact('state', 'readwrite', store => store.put(true, 'largeWarningSeen')),
    clear: async () => {
        await transact('icons', 'readwrite', store => store.clear())
        await transact('state', 'readwrite', store => store.clear())
    }
}

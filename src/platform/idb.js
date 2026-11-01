// Small IndexedDB wrapper shared by the private record store and the icon cache.
// A single place owns connection reuse, versionchange handling and transactions.
export const createDatabase = ({ name, version, upgrade, abortMessage = 'Запись хранилища прервана' }) => {
    let database
    const open = () => {
        if (!database) database = new Promise((resolve, reject) => {
            const request = indexedDB.open(name, version)
            request.onupgradeneeded = () => upgrade(request.result)
            request.onsuccess = () => {
                request.result.onversionchange = () => { request.result.close(); database = null }
                resolve(request.result)
            }
            request.onerror = () => { database = null; reject(request.error) }
        })
        return database
    }
    const transact = async (storeName, mode, operation) => {
        const db = await open()
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, mode)
            let result
            const request = operation(transaction.objectStore(storeName))
            if (request) request.onsuccess = () => { result = request.result }
            transaction.oncomplete = () => resolve(result)
            transaction.onerror = () => reject(transaction.error)
            transaction.onabort = () => reject(transaction.error || new Error(abortMessage))
        })
    }
    return { open, transact }
}

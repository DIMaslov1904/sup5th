import { createDatabase } from '../platform/idb.js'

const database = createDatabase({
    name: 'sup5th-site-icons', version: 1,
    upgrade: db => {
        db.createObjectStore('icons', { keyPath: 'origin' })
        db.createObjectStore('state')
    },
    abortMessage: 'Не удалось сохранить кеш иконок'
})
const transact = (storeName, mode, operation) => database.transact(storeName, mode, operation)

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

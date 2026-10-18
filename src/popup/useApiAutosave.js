import { onBeforeUnmount, onMounted, reactive } from 'vue'
import { saveApiSettings } from './data/projectData.js'

const fields = ['projectsUrl', 'accessUrl']
const validate = value => {
    if (!value) return true
    try {
        const url = new URL(value)
        return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
    } catch { return false }
}

export const useApiAutosave = (settings, savedSettings, onError) => {
    const states = reactive(Object.fromEntries(fields.map(field => [field, { status: 'idle', error: '' }])))
    const timers = {}, revisions = { projectsUrl: 0, accessUrl: 0 }, pending = {}, active = new Set()
    let disposed = false
    const flush = field => {
        clearTimeout(timers[field])
        if (states[field].status !== 'pending') return pending[field] || Promise.resolve(states[field].status !== 'error')
        const value = settings.value[field].trim(), revision = revisions[field]
        if (!validate(value)) {
            states[field] = { status: 'error', error: 'Укажите полный HTTP/HTTPS адрес API без логина и пароля в URL' }
            return Promise.resolve(false)
        }
        states[field] = { status: 'saving', error: '' }
        const request = saveApiSettings({ [field]: value }).then(result => {
            if (!disposed && revision === revisions[field]) {
                savedSettings.value[field] = result[field]
                settings.value[field] = result[field]
                states[field].status = 'saved'
            }
            return true
        }).catch(error => {
            if (!disposed && revision === revisions[field]) {
                states[field] = { status: 'error', error: error.message }
                onError(error)
            }
            return false
        }).finally(() => {
            active.delete(request)
            if (pending[field] === request) delete pending[field]
        })
        active.add(request); pending[field] = request
        return request
    }
    const update = (field, value) => {
        settings.value[field] = value
        revisions[field]++
        clearTimeout(timers[field])
        states[field] = { status: 'pending', error: '' }
        timers[field] = setTimeout(() => { flush(field) }, 600)
    }
    const flushAll = () => Promise.all(fields.map(flush)).then(results => results.every(Boolean))
    const cancel = () => {
        for (const field of fields) {
            clearTimeout(timers[field]); revisions[field]++
            states[field] = { status: 'idle', error: '' }
        }
        return Promise.allSettled([...active])
    }
    const pagehide = () => { flushAll() }
    onMounted(() => window.addEventListener('pagehide', pagehide))
    onBeforeUnmount(() => {
        flushAll(); disposed = true
        window.removeEventListener('pagehide', pagehide)
    })
    return { states, update, flush, flushAll, cancel }
}

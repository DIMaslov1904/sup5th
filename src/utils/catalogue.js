import switcher from './switcher.js'
import { displayUrl } from './displayUrl.js'

export const searchCatalogue = (services, projects, query) => {
    const text = String(query || '').trim().normalize('NFC').toLowerCase()
    const variants = text ? [...new Set([text, switcher(text), switcher(text, { type: 'rueng' }), switcher(text, { type: 'translit' })].filter(Boolean))] : []
    return [
        ...services.map(item => ({ ...item, kind: 'service', key: `service:${item.id}` })),
        ...projects.map(item => ({ ...item, kind: 'project', key: `project:${item.url}` }))
    ].filter(item => !variants.length || variants.some(value => `${item.name} ${item.url} ${displayUrl(item.url)}`.normalize('NFC').toLowerCase().includes(value)))
}

import switcher from './switcher.js'

export const searchCatalogue = (services, projects, query) => {
    const text = String(query || '').trim().toLowerCase()
    const variants = text ? [...new Set([text, switcher(text), switcher(text, { type: 'rueng' })])] : []
    return [
        ...services.map(item => ({ ...item, kind: 'service', key: `service:${item.id}` })),
        ...projects.map(item => ({ ...item, kind: 'project', key: `project:${item.url}` }))
    ].filter(item => !variants.length || variants.some(value => `${item.name} ${item.url}`.toLowerCase().includes(value)))
}

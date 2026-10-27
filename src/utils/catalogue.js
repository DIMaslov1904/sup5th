import switcher from './switcher.js'
import { displayUrl } from './displayUrl.js'
import { typoDistance } from './typoDistance.js'

const normalize = value => String(value || '').normalize('NFC').toLowerCase()
const words = text => text.match(/[\p{L}\p{N}]+/gu) || []
const editLimit = text => {
    const length = Array.from(text).length
    return length < 4 ? 0 : length < 8 ? 1 : 2
}

const hostname = url => {
    const value = String(url || '').replace(/^!/, '')
    try { return new URL(value.includes('://') ? value : `https://${value}`).hostname }
    catch { return '' }
}

const prepareEntry = item => {
    const host = hostname(item.url)
    return {
        item,
        text: normalize(`${item.name || ''} ${item.url || ''} ${displayUrl(item.url)}`),
        words: [...new Set(words(normalize(`${item.name || ''} ${host} ${displayUrl(host)}`)))]
    }
}

const wordDistance = (word, candidates, limit) => {
    let best = limit + 1
    for (const candidate of candidates) {
        if (candidate === word) return 0
        if (!limit) continue
        best = Math.min(best, typoDistance(word, candidate, Math.min(limit, best - 1)))
    }
    return best
}

const fuzzyDistance = (variant, candidates) => {
    let distance = 0
    for (const word of variant.words) {
        const limit = Math.min(editLimit(word), variant.limit - distance)
        const edits = wordDistance(word, candidates, limit)
        if (edits > limit) return Infinity
        distance += edits
    }
    // Keep existing substring semantics when there are no actual typos.
    return distance || Infinity
}

// Build once per catalogue update, rather than decoding URLs and normalizing
// every item on every keystroke. The closure belongs to the catalogue view.
export const createCatalogueSearch = (services, projects) => {
    const entries = [
        ...services.map(item => ({ ...item, kind: 'service', key: `service:${item.id}` })),
        ...projects.map(item => ({ ...item, kind: 'project', key: `project:${item.url}` }))
    ].map(prepareEntry)

    return query => {
        const text = normalize(query).trim()
        if (!text) return entries.map(entry => entry.item)
        const variants = [...new Set([text, switcher(text), switcher(text, { type: 'rueng' }), switcher(text, { type: 'translit' })].filter(Boolean))]
        const limit = editLimit(text)
        const fuzzyVariants = limit ? variants.map(value => ({
            words: words(value.replace(/^(?:https?:\/\/)?(?:www\.)?/, '')),
            limit
        })).filter(variant => variant.words.some(word => editLimit(word))) : []
        const exact = [], fuzzy = []

        for (const entry of entries) {
            if (variants.some(value => entry.text.includes(value))) {
                exact.push(entry.item)
                continue
            }
            let distance = Infinity
            for (const variant of fuzzyVariants) {
                distance = Math.min(distance, fuzzyDistance(variant, entry.words))
                if (distance === 1) break
            }
            if (Number.isFinite(distance)) fuzzy.push({ item: entry.item, distance })
        }
        fuzzy.sort((left, right) => left.distance - right.distance)
        return [...exact, ...fuzzy.map(match => match.item)]
    }
}

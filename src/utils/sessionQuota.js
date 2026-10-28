export const SEO_CACHE_KEY = 'popupSeoState'
export const isStorageQuotaError = error => error?.name === 'QuotaExceededError' || /exceeded.*(?:storage )?quota|quota.*exceeded/i.test(error?.message || '')

// Only discard a reproducible SEO report, never keys or pending authorization.
export const createSessionWriter = area => async values => {
    try { await area.set(values) }
    catch (error) {
        if (!isStorageQuotaError(error) || Object.hasOwn(values, SEO_CACHE_KEY)) throw error
        const cache = await area.get(SEO_CACHE_KEY)
        if (cache[SEO_CACHE_KEY] === undefined) throw error
        await area.remove(SEO_CACHE_KEY)
        await area.set(values)
    }
}

export const writeSeoSessionCache = async (area, entries) => {
    const quota = area.QUOTA_BYTES ?? 10 * 1024 * 1024
    const [used, cacheSize] = await Promise.all([area.getBytesInUse(null), area.getBytesInUse(SEO_CACHE_KEY)])
    const reserve = Math.min(1024 * 1024, quota / 4)
    const budget = Math.max(0, Math.min(8 * 1024 * 1024, quota - reserve - Math.max(0, used - cacheSize)))
    const oldestFirst = Object.keys(entries).sort((a, b) => entries[a].updatedAt - entries[b].updatedAt)
    // Conservative UTF-16 estimate also accounts for non-ASCII reports.
    const bytes = () => 2 * JSON.stringify({ [SEO_CACHE_KEY]: entries }).length
    while (oldestFirst.length && bytes() > budget) delete entries[oldestFirst.shift()]
    while (oldestFirst.length) {
        try { await area.set({ [SEO_CACHE_KEY]: entries }); return }
        catch (error) {
            if (!isStorageQuotaError(error)) throw error
            // Another writer may have consumed the budget since getBytesInUse().
            delete entries[oldestFirst.shift()]
        }
    }
    await area.remove(SEO_CACHE_KEY)
}

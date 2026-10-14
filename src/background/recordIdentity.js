// The API has no IDs. Unique identities retain local UUIDs; ambiguous duplicate
// identities retain an ID only when the full record still matches exactly.
export const assignLocalIds = (records, previous, identity) => {
    const oldGroups = Map.groupBy(previous, identity), newGroups = Map.groupBy(records, identity)
    const fingerprint = record => JSON.stringify([record.url, record.siteUrl, record.name, record.login, record.password || '',
        record.ftp ? [record.ftp.url, record.ftp.login, record.ftp.password] : null])
    const used = new Set()
    return records.map(record => {
        const key = identity(record), old = oldGroups.get(key) || []
        const match = old.length === 1 && newGroups.get(key).length === 1 ? old[0]
            : old.find(candidate => !used.has(candidate.id) && fingerprint(candidate) === fingerprint(record))
        const id = match?.id || crypto.randomUUID()
        used.add(id)
        return { ...record, id }
    })
}
export const accessIdentity = record => JSON.stringify([record.url, record.name, record.login, record.ftp?.url || '', record.ftp?.login || ''])
export const serviceIdentity = record => JSON.stringify([record.name, record.url, record.login])

import { parseSiteAddress } from './siteAddress.js'
export const getPipelineLinks = (repository, branch = 'main') => {
    if (!['main', 'master'].includes(branch) || !String(repository || '').trim()) return null
    try {
        const url = parseSiteAddress(repository)
        const path = url.pathname.replace(/\/+$/, '').replace(/\.git$/, '')
        if (!path) return null
        const base = url.origin + path
        return { repository: base, branch, badgeUrl: `${base}/badges/${branch}/pipeline.svg`, commitsUrl: `${base}/-/commits/${branch}` }
    } catch { return null }
}

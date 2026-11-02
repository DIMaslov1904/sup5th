import { onActivated, onMounted, onUnmounted, ref, watch } from 'vue'

export const AUDIT_SECTIONS = ['summary', 'issues', 'links', 'pages', 'files', 'exclusions']
const filters = ['problems', 'all', 'fail', 'warning', 'unknown', 'pass', 'na']

export const useSeoAuditView = tab => {
    const key = `seoAuditView:${tab?.id || ''}:${tab?.url || ''}`
    let saved = {}
    try { saved = JSON.parse(sessionStorage.getItem(key) || '{}') || {} } catch { /* Storage can be unavailable. */ }
    const section = ref(AUDIT_SECTIONS.includes(saved.section) ? saved.section : 'summary')
    const filter = ref(filters.includes(saved.filter) ? saved.filter : 'problems')
    const focusId = ref(typeof saved.focusId === 'string' ? saved.focusId : '')
    const readRoute = () => {
        const params = new URLSearchParams(location.search)
        if (params.get('tool') !== 'seo') return
        if (AUDIT_SECTIONS.includes(params.get('tab'))) section.value = params.get('tab')
        if (params.has('check')) { focusId.value = params.get('check') || ''; section.value = 'issues' }
        else focusId.value = ''
        if (filters.includes(params.get('status'))) filter.value = params.get('status')
    }
    readRoute()
    watch([section, filter, focusId], () => {
        try { sessionStorage.setItem(key, JSON.stringify({ section: section.value, filter: filter.value, focusId: focusId.value })) } catch { /* Keep the in-memory state. */ }
        const url = new URL(location.href)
        if (url.searchParams.get('tool') !== 'seo') return
        url.searchParams.set('tab', section.value)
        if (section.value === 'issues' && focusId.value) url.searchParams.set('check', focusId.value)
        else url.searchParams.delete('check')
        if (section.value === 'issues') url.searchParams.set('status', filter.value)
        else url.searchParams.delete('status')
        history.replaceState(history.state, '', url)
    }, { flush: 'post', immediate: true })
    onMounted(() => window.addEventListener('popstate', readRoute))
    onActivated(readRoute)
    onUnmounted(() => window.removeEventListener('popstate', readRoute))
    const openIssue = issue => { if (issue?.urlCount) { focusId.value = issue.id; section.value = 'issues' } }
    const closeIssue = () => { focusId.value = '' }
    const showStatus = status => { filter.value = status; focusId.value = ''; section.value = 'issues' }
    const resetView = () => { section.value = 'summary'; focusId.value = ''; filter.value = 'problems' }
    return { section, filter, focusId, openIssue, closeIssue, showStatus, resetView }
}

import { onMounted, onUnmounted, ref } from 'vue'
import { extensionApi } from '../platform/extensionApi.js'
import { normalizeSeoSection } from '../utils/seoSections.js'
import { seoSidePanelKey } from '../utils/seoSidePanel.js'
const tool = value => ['overview', 'seo', 'sitemap'].includes(value) ? value : 'overview'

export const useSeoSource = (docked, params) => {
    const tab = ref(null), error = ref(''), ready = ref(false), sourceRevision = ref(0)
    const section = ref(tool(params.get('tool')))
    const seoSection = ref(normalizeSeoSection(params.get('section')))
    let alive = true, revision = 0, contextRevision = 0, sourceId = null, key = ''
    const load = async id => {
        const current = ++revision
        sourceId = id; ready.value = false; error.value = ''; tab.value = null
        try {
            if (!Number.isInteger(id) || id <= 0) return
            const value = await extensionApi.tabs.get(id)
            if (!alive || current !== revision) return
            tab.value = /^https?:\/\//.test(value.url || '') ? value : null
            sourceRevision.value++
        } catch { if (alive && current === revision) error.value = 'Исходная вкладка закрыта. Откройте инструменты заново из проверяемого сайта.' }
        finally { if (alive && current === revision) ready.value = true }
    }
    const apply = value => {
        section.value = tool(value?.tool); seoSection.value = normalizeSeoSection(value?.section)
        if (value?.tabId === sourceId && tab.value && ready.value) return
        return load(value?.tabId)
    }
    const changed = (changes, area) => {
        if (area === 'session' && key && changes[key]) { contextRevision++; apply(changes[key].newValue) }
    }
    const updated = (id, changes) => {
        if (id !== sourceId) return
        if (changes.status === 'loading') { revision++; ready.value = false; tab.value = null }
        else if (changes.status === 'complete' || changes.url) load(id)
    }
    const removed = id => { if (id === sourceId) load(id) }
    onMounted(async () => {
        if (!docked) { await load(Number(params.get('tabId'))); return }
        extensionApi.storage.onChanged.addListener(changed)
        extensionApi.tabs.onUpdated.addListener(updated); extensionApi.tabs.onRemoved.addListener(removed)
        try {
            const window = await extensionApi.windows.getCurrent()
            if (!alive) return
            key = seoSidePanelKey(window.id)
            const current = contextRevision, saved = await extensionApi.storage.session.get(key)
            if (!alive || current !== contextRevision) return
            if (saved[key]) await apply(saved[key])
            else {
                const [active] = await extensionApi.tabs.query({ active: true, currentWindow: true })
                if (alive && current === contextRevision) await apply({ tabId: active?.id, tool: 'overview', section: 'overview' })
            }
        } catch (reason) { if (alive) { error.value = reason.message; ready.value = true } }
    })
    onUnmounted(() => {
        alive = false; revision++
        if (!docked) return
        extensionApi.storage.onChanged.removeListener(changed)
        extensionApi.tabs.onUpdated.removeListener(updated); extensionApi.tabs.onRemoved.removeListener(removed)
    })
    const save = () => {
        if (!docked) { history.replaceState(null, '', `?${params}`); return }
        if (key && sourceId) extensionApi.storage.session.set({ [key]: { tabId: sourceId, tool: section.value, section: seoSection.value } }).catch(reason => { if (alive) error.value = reason.message })
    }
    const select = name => { section.value = tool(name); params.set('tool', section.value); save() }
    const selectSeoSection = name => { seoSection.value = normalizeSeoSection(name); params.set('section', seoSection.value); save() }
    return { tab, error, ready, section, seoSection, sourceRevision, select, selectSeoSection }
}

import { onMounted, onUnmounted, ref } from 'vue'
import { extensionApi } from '../platform/extensionApi.js'
import { normalizeSeoSection } from '../utils/seoSections.js'
import { seoSidePanelKey } from '../utils/seoSidePanel.js'
import { siteHref } from '../utils/siteAddress.js'
const tool = value => ['overview', 'seo', 'sitemap'].includes(value) ? value : 'overview'

export const useSeoSource = (docked, params) => {
    const tab = ref(null), error = ref(''), ready = ref(false), sourceRevision = ref(0)
    const address = ref(''), addressError = ref(''), opening = ref(false)
    const section = ref(tool(params.get('tool')))
    const seoSection = ref(normalizeSeoSection(params.get('section')))
    let alive = true, revision = 0, contextRevision = 0, sourceId = null, key = '', sourceAddress = ''
    const setAddress = (url, replace = false) => {
        if (replace || !address.value || address.value === sourceAddress) address.value = url
        sourceAddress = url
    }
    const load = async id => {
        const current = ++revision
        sourceId = id; ready.value = false; error.value = ''; tab.value = null
        let loading = false
        try {
            if (!Number.isInteger(id) || id <= 0) return
            const value = await extensionApi.tabs.get(id)
            if (!alive || current !== revision) return
            const url = value.pendingUrl || value.url
            const isSite = /^https?:\/\//.test(url || '')
            loading = value.status === 'loading' || Boolean(value.pendingUrl && isSite)
            if (isSite) setAddress(url)
            if (loading) return
            tab.value = isSite ? value : null
            sourceRevision.value++
        } catch {
            if (alive && current === revision) {
                error.value = docked ? 'Исходная вкладка закрыта.' : 'Исходная вкладка закрыта. Введите адрес для новой проверки.'
            }
        }
        finally { if (alive && current === revision && !loading) ready.value = true }
    }
    const apply = value => {
        section.value = tool(value?.tool); seoSection.value = normalizeSeoSection(value?.section)
        if (value?.tabId === sourceId) return
        return load(value?.tabId)
    }
    const changed = (changes, area) => {
        if (area === 'session' && key && changes[key]) { contextRevision++; apply(changes[key].newValue) }
    }
    const updated = (id, changes) => {
        // A standalone audit can finish using its original snapshot after the source navigates.
        if (id !== sourceId || (!docked && ready.value)) return
        if (changes.status === 'loading') { revision++; ready.value = false; tab.value = null }
        else if (changes.status === 'complete' || changes.url) load(id)
    }
    const removed = id => { if (id === sourceId && (docked || !ready.value)) load(id) }
    onMounted(async () => {
        extensionApi.tabs.onUpdated.addListener(updated); extensionApi.tabs.onRemoved.addListener(removed)
        if (!docked) { await load(Number(params.get('tabId'))); return }
        extensionApi.storage.onChanged.addListener(changed)
        const current = contextRevision
        try {
            const window = await extensionApi.windows.getCurrent()
            if (!alive) return
            key = seoSidePanelKey(window.id)
            const saved = await extensionApi.storage.session.get(key)
            if (!alive || current !== contextRevision) return
            const explicitId = Number(params.get('tabId'))
            if (saved[key] || Number.isInteger(explicitId) && explicitId > 0) await apply({
                ...saved[key], ...(Number.isInteger(explicitId) && explicitId > 0 ? { tabId: explicitId } : {}),
                ...(params.has('tool') ? { tool: params.get('tool'), section: params.get('section') } : {})
            })
            else {
                const [active] = await extensionApi.tabs.query({ active: true, currentWindow: true })
                if (alive && current === contextRevision) await apply({ tabId: active?.id, tool: 'overview', section: 'overview' })
            }
        } catch (reason) { if (alive && current === contextRevision) { error.value = reason.message; ready.value = true } }
    })
    onUnmounted(() => {
        alive = false; revision++
        extensionApi.tabs.onUpdated.removeListener(updated); extensionApi.tabs.onRemoved.removeListener(removed)
        if (docked) extensionApi.storage.onChanged.removeListener(changed)
    })
    const save = (newSource = false) => {
        const current = new URLSearchParams(location.search)
        current.set('tool', section.value); current.set('section', seoSection.value)
        if (newSource) {
            current.set('tabId', String(sourceId))
            for (const name of ['tab', 'check', 'status']) current.delete(name)
        }
        history.replaceState(history.state, '', `?${current}`)
        if (!docked) return
        if (key && sourceId) extensionApi.storage.session.set({ [key]: { tabId: sourceId, tool: section.value, section: seoSection.value } }).catch(reason => { if (alive) error.value = reason.message })
    }
    const select = name => { section.value = tool(name); params.set('tool', section.value); save() }
    const selectSeoSection = name => { seoSection.value = normalizeSeoSection(name); params.set('section', seoSection.value); save() }
    const inspectAddress = async () => {
        if (opening.value) return
        const text = address.value.trim()
        const url = text && !/\s/.test(text) ? siteHref(text) : ''
        addressError.value = ''
        if (!url) { addressError.value = 'Введите адрес сайта, например https://example.com.'; return }
        if (!ready.value && sourceId && url === sourceAddress) return
        opening.value = true
        try {
            if (tab.value?.url === url) {
                setAddress(url, true)
                await load(tab.value.id)
                return
            }
            const target = await extensionApi.tabs.create({ url, active: false })
            if (!alive) return
            if (!Number.isInteger(target?.id) || target.id <= 0) throw new Error('Не получена вкладка для проверки')
            setAddress(url, true)
            const pending = load(target.id)
            save(true)
            await pending
        } catch {
            if (alive) addressError.value = 'Не удалось открыть сайт. Проверьте адрес и попробуйте ещё раз.'
        } finally {
            if (alive) opening.value = false
        }
    }
    return { tab, error, ready, address, addressError, opening, inspectAddress, section, seoSection, sourceRevision, select, selectSeoSection }
}

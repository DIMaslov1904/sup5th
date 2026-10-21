import { normalizeSeoSection } from './seoSections.js'
export const seoSidePanelKey = windowId => `seoSidePanel:${windowId}`
export const createSeoSidePanel = (api, { firefox = false } = {}) => ({
    supported: Boolean(firefox ? api?.sidebarAction?.open : api?.sidePanel?.open),
    open: (tab, section = 'overview') => {
        if (!Number.isInteger(tab?.id) || !Number.isInteger(tab?.windowId) || !/^https?:\/\//.test(tab?.url || '')) throw new Error('Откройте проверяемый сайт')
        const panel = firefox ? api?.sidebarAction : api?.sidePanel
        if (!panel?.open) throw new Error('Боковая панель не поддерживается этим браузером')
        // Native open must run in the click handler, before any awaited work.
        const saved = api.storage.session.set({ [seoSidePanelKey(tab.windowId)]: { tabId: tab.id, tool: 'overview', section: normalizeSeoSection(section) } })
        const activated = api.tabs.update(tab.id, { active: true })
        const opened = firefox ? panel.open() : panel.open({ windowId: tab.windowId })
        return Promise.all([saved, activated, opened]).then(() => undefined)
    }
})

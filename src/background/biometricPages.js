import { extensionApi } from '../platform/extensionApi.js'
import { sessionGet, sessionSet } from './storageRepository.js'
import { enableHelloProtection, getSecurityStatus } from './credentialVault.js'
import { startAdminAuth, copyProjectAccessText, getProjectAccessField, getServiceField } from './projectAccess.js'
import { saveApiSettings } from './apiSettings.js'
import { getSshCommand } from '../utils/ssh.js'

export const BIOMETRIC_PAGES_KEY = 'biometricPageRequests'
const pagePath = 'src/biometric/index.html', lifetime = 5 * 60000
const copyFields = ['login', 'password', 'text', 'ftpUrl', 'ftpLogin', 'ftpPassword', 'ssh']
const validText = value => typeof value === 'string' && value.length > 0 && value.length <= 2048
const validateIntent = intent => {
    if (!intent) return null
    if (intent.type === 'refresh' && ['all', 'projects', 'accesses'].includes(intent.scope) && (!intent.setupStep || intent.setupStep === 'done')) return { type: intent.type, scope: intent.scope, setupStep: intent.setupStep }
    if (intent.type === 'service-copy' && validText(intent.id) && ['login', 'password'].includes(intent.field)) return { type: intent.type, id: intent.id, field: intent.field }
    if (['auth', 'project-copy'].includes(intent.type) && validText(intent.url) && validText(intent.accessId) && (intent.type === 'auth' || copyFields.includes(intent.field))) return { type: intent.type, url: intent.url, accessId: intent.accessId, field: intent.field }
    throw new Error('Неизвестное действие после разблокировки')
}

const checkedPage = (flow, id, sender) => {
    if (!flow || flow.expiresAt <= Date.now()) throw new Error('Запрос биометрии истёк. Откройте его заново из расширения.')
    const url = new URL(sender.url || 'about:blank')
    if (sender.id !== extensionApi.runtime.id || sender.tab?.id !== flow.tabId || sender.url.split(/[?#]/)[0] !== extensionApi.runtime.getURL(pagePath) || url.searchParams.get('request') !== id) throw new Error('Запрос недоступен этой странице')
    return flow
}

const executeIntent = async (intent, refreshData) => {
    if (!intent) return { kind: 'done' }
    if (intent.type === 'auth') { await startAdminAuth(intent); return { kind: 'auth' } }
    if (intent.type === 'refresh') {
        const data = await refreshData({ scope: intent.scope })
        if (data.refreshErrors?.length) throw new Error(data.refreshErrors.join('\n'))
        if (intent.setupStep) await saveApiSettings({ setupStep: intent.setupStep })
        return { kind: 'refresh' }
    }
    if (intent.type === 'service-copy') return { kind: 'copy', value: await getServiceField(intent) }
    if (intent.field === 'text') return { kind: 'copy', value: await copyProjectAccessText(intent) }
    if (intent.field === 'ssh') {
        const [host, login] = await Promise.all(['ftpUrl', 'ftpLogin'].map(field => getProjectAccessField({ ...intent, field })))
        return { kind: 'copy', value: getSshCommand(login, host) }
    }
    return { kind: 'copy', value: await getProjectAccessField(intent) }
}

export const createBiometricPageHandlers = ({ unlock, refreshData }) => {
    let pending = Promise.resolve()
    const serial = action => { const result = pending.then(action); pending = result.catch(() => {}); return result }
    const read = () => sessionGet(BIOMETRIC_PAGES_KEY, {})
    const write = flows => sessionSet(BIOMETRIC_PAGES_KEY, flows)
    const open = payload => serial(async () => {
        if (!['enable', 'unlock'].includes(payload.mode)) throw new Error('Неизвестный сценарий биометрии')
        const status = await getSecurityStatus()
        if (payload.mode === 'enable' && status.enabled) throw new Error('Защита уже включена')
        if (payload.mode === 'unlock' && !status.enabled) throw new Error('Защита ещё не включена')
        const intent = validateIntent(payload.intent), id = crypto.randomUUID()
        const [returnTab] = await extensionApi.tabs.query({ active: true, currentWindow: true })
        const tab = await extensionApi.tabs.create({ url: 'about:blank', active: false })
        const flows = Object.fromEntries(Object.entries(await read()).filter(([, flow]) => flow.expiresAt > Date.now()))
        flows[id] = { mode: payload.mode, intent, advanceSetup: payload.mode === 'enable' && payload.advanceSetup === true, refreshAfterUnlock: payload.refreshAfterUnlock !== false, tabId: tab.id, returnTabId: returnTab?.id, state: 'pending', expiresAt: Date.now() + lifetime }
        await write(flows)
        try { await extensionApi.tabs.update(tab.id, { url: `${extensionApi.runtime.getURL(pagePath)}?request=${id}`, active: true }) }
        catch (error) { delete flows[id]; await write(flows); await extensionApi.tabs.remove(tab.id); throw error }
        return { id }
    })
    const get = async ({ id }, sender) => checkedPage((await read())[id], id, sender)
    const complete = (payload, sender) => serial(async () => {
        const flows = await read(), flow = checkedPage(flows[payload.id], payload.id, sender)
        if (flow.state !== 'pending') throw new Error('Этот запрос уже обработан')
        flow.state = 'processing'; await write(flows)
        try {
            if (flow.mode === 'enable') await enableHelloProtection(payload.protection)
            else await unlock({ key: payload.key, refreshAfterUnlock: flow.intent?.type === 'refresh' ? false : flow.refreshAfterUnlock })
        } catch (error) { flow.state = 'pending'; await write(flows); throw error }
        // Never persist credentials, PRF secrets, vault keys or copied values here.
        let action
        try {
            if (flow.advanceSetup) await saveApiSettings({ setupStep: 'accesses' })
            action = await executeIntent(flow.intent, refreshData)
        }
        catch (error) { action = { kind: 'error', error: error.message } }
        flow.state = action.kind === 'error' ? 'failed' : 'done'; await write(flows)
        return { status: await getSecurityStatus(), action }
    })
    const cancel = ({ id }, sender) => serial(async () => {
        const flows = await read(), flow = checkedPage(flows[id], id, sender)
        if (flow.state === 'pending') { flow.state = 'cancelled'; await write(flows) }
        return { cancelled: flow.state === 'cancelled' }
    })
    const result = async ({ id }) => {
        const flow = (await read())[id]
        if (!flow || flow.expiresAt <= Date.now()) return { state: 'expired' }
        return { state: flow.state }
    }
    extensionApi.tabs.onRemoved.addListener(tabId => {
        serial(async () => {
            const flows = await read()
            for (const flow of Object.values(flows)) if (flow.tabId === tabId && flow.state === 'pending') flow.state = 'cancelled'
            await write(flows)
        }).catch(error => console.error('[biometric] tab closed', error))
    })
    return { 'security:page:open': open, 'security:page:get': get, 'security:page:complete': complete, 'security:page:cancel': cancel, 'security:page:result': result }
}

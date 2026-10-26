import { extensionApi } from '../platform/extensionApi.js'
import { SERVICES_KEY, storageGet, sessionGet, sessionSet, mutateStorage } from './storageRepository.js'
import { getServiceField } from './projectAccess.js'
import { vaultRevision, assertVaultRevision } from './credentialVault.js'
import { SUPPORT_ORIGIN, SUPPORT_LOGIN_PATH, SUPPORT_EXPIRED_PATH, SUPPORT_INDEX_PATH, supportUrl, supportTicketTarget } from '../utils/supportAuth.js'

const SUPPORT_AUTH_KEY = 'pendingSupportAuth'
const AUTH_LIFETIME = 300000
const manual = message => ({ action: 'manual', message })
const readSessions = async () => Object.fromEntries(Object.entries(await sessionGet(SUPPORT_AUTH_KEY, {}))
    .filter(([, state]) => state.expiresAt > Date.now()))
const newSession = targetUrl => ({ targetUrl, attempted: false, restoring: false, expiresAt: Date.now() + AUTH_LIFETIME })

export const openSupportTicket = async ({ number }) => {
    if (typeof number !== 'string' || !/^[1-9]\d*$/.test(number)) throw new Error('Введите положительный целый номер тикета')
    const targetUrl = `${SUPPORT_ORIGIN}${SUPPORT_INDEX_PATH}?app=ST#/requests/search/${number}/`
    const tab = await extensionApi.tabs.create({ url: 'about:blank' })
    try {
        await mutateStorage(async () => {
            const sessions = await readSessions()
            sessions[tab.id] = newSession(targetUrl)
            await sessionSet(SUPPORT_AUTH_KEY, sessions)
        })
        await extensionApi.tabs.update(tab.id, { url: targetUrl })
    } catch (error) {
        await forgetSupportAuthTab(tab.id)
        await extensionApi.tabs.remove(tab.id).catch(() => {})
        throw error
    }
    return { opened: true }
}

const supportCredentials = async () => {
    const services = (await storageGet(SERVICES_KEY, [])).filter(service => supportUrl(service.url))
        .filter(service => service.login && (service.password || service.hasPassword))
    if (services.length !== 1) throw new Error(services.length
        ? 'В «Сервисах» несколько доступов к support.5th.ru. Войдите вручную.'
        : 'В «Сервисах» нет полного доступа к https://support.5th.ru. Войдите вручную.')
    const expected = vaultRevision(), id = services[0].id
    const [login, password] = await Promise.all([getServiceField({ id, field: 'login' }), getServiceField({ id, field: 'password' })])
    assertVaultRevision(expected)
    return { login, password }
}

export const supportAuthPage = (payload, sender) => mutateStorage(async () => {
    const page = supportUrl(sender.url)
    if (sender.id !== extensionApi.runtime.id || sender.frameId !== 0 || !Number.isInteger(sender.tab?.id) || !page) {
        throw new Error('Авторизация доступна только в основной вкладке support.5th.ru')
    }
    const tabId = sender.tab.id, sessions = await readSessions(), target = supportTicketTarget(page.href)
    let state = sessions[tabId]
    if (target && target !== state?.targetUrl) state = sessions[tabId] = newSession(target)
    await sessionSet(SUPPORT_AUTH_KEY, sessions)
    if (!state) return { action: 'none' }
    if (page.pathname === SUPPORT_EXPIRED_PATH) return { action: 'login', url: SUPPORT_ORIGIN + SUPPORT_LOGIN_PATH }
    if (page.pathname === SUPPORT_INDEX_PATH && !payload.loginFormReady) {
        if (target === state.targetUrl) {
            delete sessions[tabId]
            await sessionSet(SUPPORT_AUTH_KEY, sessions)
            return { action: 'none' }
        }
        if (state.restoring) return manual('Не удалось открыть тикет. Откройте его повторно из расширения.')
        state.restoring = true
        await sessionSet(SUPPORT_AUTH_KEY, sessions)
        return { action: 'redirect', url: state.targetUrl }
    }
    if (page.pathname !== SUPPORT_LOGIN_PATH) {
        delete sessions[tabId]
        await sessionSet(SUPPORT_AUTH_KEY, sessions)
        return { action: 'none' }
    }
    if (state.attempted) return manual('Автоматический вход уже выполнен. Если форма осталась, проверьте доступы и войдите вручную.')
    if (!payload.loginFormReady) return manual('Форма входа изменилась. Войдите вручную.')
    try {
        const expected = vaultRevision()
        const credentials = await supportCredentials()
        // A navigation may have started while the protected credentials were being read.
        const tab = await extensionApi.tabs.get(tabId)
        const current = supportUrl(tab.pendingUrl || tab.url)
        if (!current || current.href !== page.href) return { action: 'none' }
        assertVaultRevision(expected)
        state.attempted = true
        await sessionSet(SUPPORT_AUTH_KEY, sessions)
        assertVaultRevision(expected)
        return { action: 'submit', ...credentials }
    } catch (error) { return manual(error.message) }
})

export const forgetSupportAuthTab = tabId => mutateStorage(async () => {
    const sessions = await readSessions()
    if (!Object.hasOwn(sessions, tabId)) return
    delete sessions[tabId]
    await sessionSet(SUPPORT_AUTH_KEY, sessions)
})

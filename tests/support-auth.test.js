import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import test from 'node:test'

const makeStorage = (values = {}) => ({
    async get(key) { return { [key]: structuredClone(values[key]) } },
    async set(entries) { Object.assign(values, structuredClone(entries)) },
    async setAccessLevel() {}
})
const services = []
let tabUrl = ''
globalThis.chrome = {
    runtime: { id: 'fixture', getURL: path => 'chrome-extension://fixture/' + path },
    storage: { local: makeStorage({ schemaVersion: 1, services }), session: makeStorage() },
    tabs: {
        async create({ url }) { tabUrl = url; return { id: 1 } },
        async update(id, { url }) { tabUrl = url },
        async get() { return { url: tabUrl } }
    }
}

const viteScript = registerHooks({
    load(url, context, nextLoad) {
        if (url.endsWith('?script&iife')) return { format: 'module', source: 'export default "fixture.js"', shortCircuit: true }
        return nextLoad(url, context)
    }
})
const { openSupportHome, openSupportTicket, supportAuthPage } = await import('../src/background/supportAuth.js')
viteScript.deregister()
const home = 'https://support.5th.ru/published/index.php?app=ST'
const login = 'https://support.5th.ru/published/login.php'
const visit = (url, loginFormReady = false) => {
    tabUrl = url
    return supportAuthPage({ loginFormReady }, { id: 'fixture', frameId: 0, tab: { id: 1 }, url })
}

test('opens Support and signs in only when the tab has a pending session and saved access', async () => {
    assert.deepEqual(await visit(login, true), { action: 'none' })

    await openSupportHome()
    assert.equal(tabUrl, home)
    assert.equal((await visit(login, true)).action, 'manual')
    assert.deepEqual(await visit(home + '#/requests/'), { action: 'none' })
    assert.deepEqual(await visit(login, true), { action: 'none' })

    services.push({ id: 'support', url: home, login: 'fixture', password: 'fixture-password' })
    await openSupportHome()
    assert.deepEqual(await visit(login, true), { action: 'submit', login: 'fixture', password: 'fixture-password' })
    assert.deepEqual(await visit('https://support.5th.ru/published/index.php'), { action: 'redirect', url: home })
    assert.deepEqual(await visit(home), { action: 'none' })
    assert.deepEqual(await visit(login, true), { action: 'none' })
})

test('still restores the ticket search after sign-in', async () => {
    const ticketUrl = home + '#/requests/search/12345/'
    await openSupportTicket({ number: '12345' })
    assert.equal(tabUrl, ticketUrl)
    assert.deepEqual(await visit(home), { action: 'redirect', url: ticketUrl })
    assert.deepEqual(await visit(ticketUrl), { action: 'none' })
})

import assert from 'node:assert/strict'
import test, { beforeEach } from 'node:test'
import { apiUrls, parsePanelConnection } from '../src/utils/apiSource.js'

const makeStorage = (initial = {}) => ({
    values: { ...initial },
    async get(key) { return { [key]: structuredClone(this.values[key]) } },
    async set(values) { Object.assign(this.values, structuredClone(values)) },
    async remove(keys) { for (const key of [].concat(keys)) delete this.values[key] },
    async setAccessLevel() {}
})
const projectsUrl = 'https://script.google.com/macros/s/projects/exec'
const accessUrl = 'https://script.google.com/macros/s/accesses/exec'
const panelUrl = 'http://127.0.0.1:8000'
const token = 'sup5th_' + 'a'.repeat(64)
const connection = (url = panelUrl, secret = token) => 'sup5th-connect-v1.' + Buffer.from(JSON.stringify({ url, token: secret })).toString('base64url')
const project = ['Панель', 'https://project.example.test', '', '', 'Bitrix', '', '']
const service = ['Сервис', 'https://service.example.test', 'fixture', 'fixture-password']
const initial = () => ({ schemaVersion: 1, apiSettings: { projectsUrl, accessUrl } })
const local = makeStorage(initial())
const session = makeStorage()

globalThis.chrome = {
    runtime: { getURL: path => 'chrome-extension://fixture/' + path },
    storage: { local, session },
    tabs: {}
}
const { readApiSettings, saveApiSettings } = await import('../src/background/apiSettings.js')
const { getStoredData, storageReady } = await import('../src/background/storageRepository.js')
const { getRefreshJob, refreshAll } = await import('../src/background/apiRefresh.js')
const { enablePinProtection, lockCredentialVault, unlockWithPin, disableCredentialProtection } = await import('../src/background/credentialVault.js')
await storageReady
beforeEach(() => { local.values = initial(); session.values = {} })

test('keeps the Google connection and uses the configured panel with Bearer authentication', async t => {
    assert.deepEqual(apiUrls(await readApiSettings()), { projects: projectsUrl, accesses: accessUrl })
    assert.deepEqual(parsePanelConnection(' ' + connection(panelUrl + '/admin/profile/') + '\n'), { panelUrl, panelToken: token })
    await assert.rejects(saveApiSettings({ source: 'panel', panelConnection: connection('http://panel.example.test') }), /HTTPS/)
    await assert.rejects(saveApiSettings({ source: 'panel', panelConnection: connection(panelUrl, 'invalid') }), /строку подключения/)
    await assert.rejects(saveApiSettings({ source: 'panel', panelConnection: token }), /строку подключения/)
    await assert.rejects(saveApiSettings({ source: 'panel', panelConnection: 'sup5th-connect-v1.YQ' }), /строку подключения/)
    assert.equal((await readApiSettings()).source, 'google')

    const requests = []
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        requests.push({ url, options })
        return url.endsWith('/accesses') ? Response.json({ result: { access: [], services: [service] } })
            : Response.json({ result: [url === projectsUrl ? ['Google', 'https://google.example.test'] : project] })
    })
    await refreshAll({ scope: 'projects' })
    assert.equal(requests[0].url, projectsUrl)
    assert.equal(requests[0].options.credentials, 'include')
    assert.equal(requests[0].options.redirect, 'follow')
    assert.equal(requests[0].options.headers.Authorization, undefined)

    const saved = await saveApiSettings({ source: 'panel', panelConnection: connection(panelUrl + '/admin') })
    assert.equal(saved.panelTokenSaved, true)
    assert.equal(saved.panelToken, undefined)
    assert.equal(local.values.apiSettings.panelConnection, undefined)
    assert.equal((await readApiSettings()).panelToken, undefined)
    assert.equal((await getStoredData()).lastSuccessfulData.projects.length, 0)
    await assert.rejects(saveApiSettings({ panelConnection: connection('https://name:pass@example.test') }), /HTTPS/)
    assert.equal((await readApiSettings()).panelUrl, panelUrl)

    const data = await refreshAll()
    assert.deepEqual(data.refreshErrors, [])
    assert.equal(data.lastSuccessfulData.projects[0].name, project[0])
    assert.equal(local.values.services[0].password, service[3])
    assert.deepEqual(new Set(requests.slice(1).map(({ url }) => url)), new Set(Object.values(apiUrls(saved))))
    for (const { options } of requests.slice(1)) {
        assert.equal(options.headers.Authorization, 'Bearer ' + token)
        assert.equal(options.credentials, 'omit')
        assert.equal(options.redirect, 'error')
        assert.equal(options.cache, 'no-store')
    }

    await enablePinProtection({ pin: '135790' })
    assert.notEqual(local.values.apiSettings.panelToken, token)
    await lockCredentialVault()
    local.values.projectData.lastSuccessfulData.projectsUpdatedAt = 0
    const count = requests.length
    await refreshAll({ onlyIfDue: true })
    await assert.rejects(refreshAll({ scope: 'projects' }), /Разблокируйте/)
    assert.equal(requests.length, count)
    await unlockWithPin({ pin: '135790' })
    const unlocked = await refreshAll({ scope: 'accesses' })
    assert.deepEqual(unlocked.refreshErrors, [])
    assert.equal(requests.at(-1).options.headers.Authorization, 'Bearer ' + token)
    assert.equal(local.values.services[0].password, undefined)

    await saveApiSettings({ source: 'google' })
    assert.deepEqual(apiUrls(await readApiSettings()), { projects: projectsUrl, accesses: accessUrl })
    assert.equal((await getStoredData()).lastSuccessfulData.projects.length, 0)
    assert.deepEqual(local.values.services, [])
    await disableCredentialProtection()
    assert.equal(local.values.apiSettings.panelToken, token)
})

test('uses an existing connection after an upgrade and reports a revoked token without leaking it', async t => {
    Object.assign(local.values.apiSettings, { panelUrl, panelToken: token })
    const { promise: started, resolve: requestStarted } = Promise.withResolvers()
    const { promise: response, resolve: resolveOld } = Promise.withResolvers()
    t.mock.method(globalThis, 'fetch', async () => { requestStarted(); return response })
    const cancelled = assert.rejects(refreshAll({ scope: 'projects' }), /Данные изменились/)
    await started
    await saveApiSettings({ source: 'panel' })
    assert.equal((await readApiSettings()).panelTokenSaved, true)
    resolveOld(Response.json({ result: [['Старые данные', 'https://old.example.test']] }))
    await cancelled
    assert.equal((await getStoredData()).lastSuccessfulData.projects.length, 0)
    assert.equal((await getRefreshJob()).running, false)

    globalThis.fetch.mock.mockImplementation(async () => Response.json({ error: token }, { status: 401 }))
    const result = await refreshAll({ scope: 'projects' })
    assert.match(result.refreshErrors.join(), /Панель отклонила токен/)
    assert.ok(!JSON.stringify(local.values.apiErrorLog).includes(token))
    assert.equal(result.projectApiStatus, '')
})

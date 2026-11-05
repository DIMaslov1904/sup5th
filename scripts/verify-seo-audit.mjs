import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { startAuditFixture } from '../tests/seo-audit-fixture.mjs'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const output = resolve(process.env.SEO_AUDIT_OUTPUT || join(tmpdir(), 'sup5th-seo-ui'))
const extensionPath = resolve(process.env.SEO_AUDIT_DIST || 'dist')
assert.ok(existsSync(join(extensionPath, 'manifest.json')), 'Build Chromium with npm run build first')
await mkdir(output, { recursive: true })
await rm(join(output, 'verification.json'), { force: true })
const profile = await mkdtemp(join(tmpdir(), 'sup5th-seo-profile-'))
let context, fixture, ui
const verified = [], uncaught = []
const pass = name => { verified.push(name); console.log('PASS ' + name) }

const tabs = name => ui.getByRole('tablist', { name, exact: true })
const resultTab = name => tabs('Разделы SEO-аудита').getByRole('tab', { name })
const modeTab = name => tabs('Режим проверки').getByRole('tab', { name, exact: true })
const button = name => ui.getByRole('button', { name, exact: true })
const startButton = () => button('Запустить аудит')
const limit = () => ui.getByLabel('Лимит HTTP-проверки', { exact: true })
const finished = () => startButton().waitFor()
const run = async () => { await startButton().click(); await finished() }
const download = async (name, filename) => {
    const [file] = await Promise.all([ui.waitForEvent('download'), button(name).click()])
    const path = join(output, filename)
    await file.saveAs(path)
    return readFile(path, 'utf8')
}
const report = async filename => JSON.parse(await download('Скачать отчёт (JSON)', filename))
const withPendingRequest = async action => {
    const held = fixture.holdSiteResponse('/')
    try {
        await startButton().click()
        await Promise.race([
            held.started,
            delay(15000, undefined, { ref: false }).then(() => { throw new Error('Audit did not request the source page') })
        ])
        await action(held.release)
    } finally {
        held.release()
    }
}

try {
    fixture = await startAuditFixture()
    const browser = process.env.SEO_BROWSER_EXECUTABLE
        ? { executablePath: process.env.SEO_BROWSER_EXECUTABLE }
        : { channel: existsSync(chromium.executablePath()) ? 'chromium' : 'chrome' }
    context = await chromium.launchPersistentContext(profile, {
        ...browser, headless: true, acceptDownloads: true,
        args: ['--enable-unsafe-extension-debugging'], ignoreDefaultArgs: ['--disable-extensions']
    })
    const cdp = await context.browser().newBrowserCDPSession()
    const { id } = await cdp.send('Extensions.loadUnpacked', { path: extensionPath })
    const browserVersion = await cdp.send('Browser.getVersion')
    const worker = context.serviceWorkers().find(candidate => new URL(candidate.url()).host === id)
        || await context.waitForEvent('serviceworker', candidate => new URL(candidate.url()).host === id)
    const sourceUrl = fixture.origin + '/'
    const source = context.pages()[0]
    await source.goto(sourceUrl)
    const tab = await worker.evaluate(async url => (await chrome.tabs.query({})).find(item => item.url === url), sourceUrl)
    assert.ok(tab?.id, 'Fixture tab is visible to the installed extension')
    assert.ok((await context.cookies(sourceUrl)).some(cookie => cookie.name === 'seo_fixture'))

    ui = await context.newPage()
    ui.setDefaultTimeout(15000)
    ui.on('pageerror', error => uncaught.push(error.message))
    const app = 'chrome-extension://' + id
    const auditUrl = app + '/src/options/index.html?tool=seo&tabId=' + tab.id
    await ui.goto(auditUrl)
    await modeTab('Внутренние ссылки').click()
    await limit().fill('15')
    const custom = ui.getByLabel('Свои исключения', { exact: true })
    assert.equal(await custom.isVisible(), false)
    await ui.getByText('Дополнительно', { exact: true }).click()
    await custom.fill('Disallow: /custom-blocked')
    const startIndex = fixture.requests.length
    await withPendingRequest(async release => {
        await button('Пауза').click()
        await button('Продолжить').waitFor()
        assert.equal(await modeTab('Внутренние ссылки').isDisabled(), true)
        assert.equal(await custom.isDisabled(), true)
        await limit().fill('16')
        await button('Продолжить').click()
        release()
        await finished()
    })
    const internal = await report('report.json')
    assert.equal(internal.state, 'done')
    assert.equal(internal.settings.mode, 'internal')
    assert.equal(internal.settings.pageLimit, 16)
    assert.equal(internal.settings.customExclusions, 'Disallow: /custom-blocked')
    pass('Pause and resume preserve the edited request limit and audit settings')

    const requests = fixture.requests.slice(startIndex)
    const paths = requests.filter(item => item.site === 'site' && item.method === 'GET').map(item => item.path)
    const exclusions = new Map(internal.audit.exclusions.items.map(item => [new URL(item.url).pathname, item]))
    assert.equal(paths.includes('/robots-blocked') || paths.includes('/custom-blocked'), false)
    assert.equal(paths.includes('/noindex'), true)
    assert.match(exclusions.get('/robots-blocked')?.reason, /robots\.txt/)
    assert.match(exclusions.get('/custom-blocked')?.reason, /Свои исключения/)
    assert.match(exclusions.get('/noindex')?.reason, /X-Robots-Tag/)
    assert.equal(requests.some(item => item.cookie || item.site === 'external'), false)
    assert.ok(internal.audit.robotsFile.exists)
    assert.equal(internal.audit.sitemap.state, 'valid')
    assert.equal(internal.audit.sitemap.complete, true)
    assert.equal(internal.audit.llmTxt.exists, true)
    assert.ok(internal.audit.pageResults.some(item => item.url === fixture.origin + '/sitemap-only'))
    pass('Internal audit reads robots.txt, nested sitemap and llm.txt without cookies or blocked requests')

    const redirect = internal.audit.results.find(item => item.url === fixture.origin + '/redirect')
    assert.equal(redirect?.finalUrl, fixture.origin + '/landing')
    assert.equal(redirect.response.headers['x-fixture-final'], 'true')
    assert.equal(Object.hasOwn(redirect.response.headers, 'x-api-key'), false)
    assert.ok(redirect.response.chain.some(hop => hop.status === 302 && hop.headers['x-fixture-hop'] === 'internal'))
    assert.ok(internal.audit.results.some(item => item.url === fixture.origin + '/manual.pdf' && item.kind === 'document'))
    pass('Internal redirects preserve hop and final headers, and private headers stay out of the report')

    for (const [status, count] of Object.entries(internal.summary)) {
        assert.equal(Number(await ui.locator(`[data-audit-summary="${status}"]`).innerText()), count)
    }
    await ui.locator('[data-audit-summary="fail"]').click()
    await ui.locator('[data-audit-issue="links-http"]').getByRole('button').first().click()
    const focusUrls = ui.locator('[data-audit-focus-url] > a')
    assert.deepEqual((await focusUrls.evaluateAll(anchors => anchors.map(anchor => anchor.href))).sort(),
        ['/missing', '/server-error'].map(path => fixture.origin + path).sort())
    assert.equal(new URL(ui.url()).searchParams.get('check'), 'links-http')
    await button('← К ошибкам').click()
    assert.equal(await ui.getByLabel('Фильтр проблем аудита').inputValue(), 'fail')
    pass('Summary counts agree with JSON and HTTP problems link to the exact affected URLs')

    await resultTab(/^Ссылки/).click()
    assert.equal(await ui.getByLabel('Направление ссылки').count(), 0)
    await ui.getByLabel('HTTP-статус', { exact: true }).selectOption('4xx')
    assert.equal(await ui.locator('[data-audit-result]').count(), 1)
    await ui.getByLabel('HTTP-статус', { exact: true }).selectOption('redirects')
    assert.equal(await ui.locator('[data-audit-result]').count(), 1)
    await ui.getByLabel('HTTP-статус', { exact: true }).selectOption('all')
    await ui.getByLabel('Тип URL', { exact: true }).selectOption('document')
    const search = ui.getByRole('searchbox')
    await search.fill('manual')
    const csv = await download('Скачать CSV (1)', 'links.csv')
    assert.match(csv, /manual\.pdf/)
    assert.match(csv, /"Направление"/)
    assert.match(csv, /"Внутренняя"/)
    assert.doesNotMatch(csv, /server-error/)
    await resultTab(/^Страницы/).click()
    await resultTab(/^Ссылки/).click()
    assert.equal(await search.inputValue(), 'manual')
    assert.equal(await ui.getByLabel('Тип URL', { exact: true }).inputValue(), 'document')
    pass('HTTP, type and text filters match CSV output and survive switching result tabs')

    await resultTab(/^Страницы/).click()
    await search.fill('/empty')
    await button(fixture.origin + '/empty').click()
    assert.match(await ui.locator('[data-audit-page-details]').innerText(), /Не заполнен/)
    await button('Страницы без Title →').click()
    assert.equal(new URL(ui.url()).searchParams.get('check'), 'pages-missing-title')
    assert.equal(await focusUrls.count(), 1)
    await resultTab(/^Страницы/).click()
    await button('← К страницам').click()
    await tabs('Инструменты расширения').getByRole('tab', { name: 'Единый sitemap' }).click()
    await tabs('Инструменты расширения').getByRole('tab', { name: 'Детальный аудит' }).click()
    assert.equal(await search.inputValue(), '/empty')
    assert.equal(await limit().inputValue(), '16')
    await ui.setViewportSize({ width: 360, height: 850 })
    assert.equal(await ui.locator('.audit-table-wrapper thead').evaluate(element => getComputedStyle(element).display), 'none')
    assert.ok(await ui.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    pass('Page details link to issues, tools keep their result state and tables fit a narrow viewport')

    await withPendingRequest(async release => {
        await button('Остановить аудит').click()
        release()
        await finished()
    })
    assert.equal((await report('partial.json')).state, 'partial')
    pass('Stopping during a request keeps a partial report')

    await modeTab('Внешние ссылки').click()
    await limit().fill('5')
    await ui.getByLabel('Лимит обхода страниц', { exact: true }).fill('12')
    const externalStart = fixture.requests.length
    await run()
    const external = await report('external.json')
    assert.equal(external.state, 'done')
    assert.equal(external.settings.mode, 'external')
    assert.deepEqual(fixture.requests.slice(externalStart).filter(item => item.site === 'external')
        .map(item => item.method + ' ' + item.path).sort(), ['HEAD /head-only', 'HEAD /ok', 'HEAD /redirect'])
    const byPath = new Map(external.audit.results.map(item => [new URL(item.url).pathname, item]))
    assert.equal(byPath.get('/ok')?.availability, 'available')
    assert.equal(byPath.get('/head-only')?.status, 405)
    assert.equal(byPath.get('/redirect')?.redirectUrl, fixture.externalOrigin + '/destination')
    await ui.getByLabel('Доступность внешних ссылок', { exact: true }).selectOption('redirect')
    assert.equal(await ui.locator('[data-audit-availability]').count(), 1)
    pass('External audit sends one HEAD per URL, exposes the redirect target and applies its response filter')

    await ui.goto(app + '/src/sidepanel/index.html?tool=seo&tabId=' + tab.id + '&tab=issues&check=pages-missing-title')
    await run()
    assert.equal(await resultTab(/^Ошибки/).getAttribute('aria-selected'), 'true')
    assert.equal(await focusUrls.first().getAttribute('href'), fixture.origin + '/empty')
    pass('Side panel opens the requested issue after a fresh audit')
    assert.deepEqual(uncaught, [])
    await writeFile(join(output, 'verification.json'), JSON.stringify({ browserVersion, verified }, null, 2))
    await rm(join(output, 'failure.txt'), { force: true })
    console.log('UI verification passed. Evidence: ' + output)
} catch (error) {
    const body = await ui?.locator('body').innerText({ timeout: 1500 }).catch(() => '')
    await writeFile(join(output, 'failure.txt'), error.stack + (body ? '\n\n' + body : ''))
    throw error
} finally {
    await context?.close()
    await fixture?.close()
    await rm(profile, { recursive: true, force: true })
}

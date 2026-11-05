import { once } from 'node:events'
import { createServer } from 'node:http'

const listen = async handle => {
    const server = createServer(handle)
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    return server
}

const originOf = server => `http://127.0.0.1:${server.address().port}`
const close = server => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve())
})

const html = (title, links = [], meta = '') => `<!doctype html><html lang="ru"><head>
    <meta charset="utf-8"><title>${title}</title><meta name="description" content="Локальная страница браузерной проверки">
    <link rel="icon" href="data:,">
    ${meta}</head><body><h1>${title || 'Страница без Title'}</h1>
    ${links.map(url => `<a href="${url}">${url}</a>`).join(' ')}
    </body></html>`

const respond = (request, response, status, type, body, headers = {}) => {
    response.writeHead(status, { 'cache-control': 'no-store', 'content-type': type, ...headers })
    response.end(request.method === 'HEAD' ? undefined : body)
}

export const startAuditFixture = async () => {
    const requests = []
    const held = new Map()
    const track = (site, request) => {
        const path = new URL(request.url, 'http://localhost').pathname
        requests.push({ site, path, method: request.method, cookie: request.headers.cookie })
        return path
    }
    const external = await listen((request, response) => {
        const path = track('external', request)
        if (path === '/redirect') return respond(request, response, 302, 'text/plain', '', { location: '/destination', 'x-fixture-hop': 'external' })
        const status = path === '/head-only' && request.method === 'HEAD' ? 405 : 200
        respond(request, response, status, 'text/plain', 'External fixture')
    })
    const externalOrigin = originOf(external)
    const indexLinks = ['/empty', '/missing', '/server-error', '/redirect', '/manual.pdf', '/robots-blocked', '/custom-blocked', '/noindex',
        ...['/ok', '/redirect', '/head-only'].map(path => externalOrigin + path)]
    const pages = new Map([
        ['/', html('SEO smoke fixture', indexLinks)],
        ['/empty', html('')],
        ['/landing', html('Redirect target')],
        ['/sitemap-only', html('From sitemap')],
        ['/noindex', html('Noindex target')],
        ['/custom-blocked', html('Custom rule target')],
        ['/robots-blocked', html('Robots rule target')]
    ])
    let site
    try {
        site = await listen(async (request, response) => {
            const path = track('site', request)
            const gate = held.get(path)
            if (gate) { gate.started(); await gate.wait }
            const origin = originOf(site)
            if (path === '/robots.txt') {
                return respond(request, response, 200, 'text/plain', `User-agent: *\nDisallow: /robots-blocked\nSitemap: ${origin}/sitemap.xml\n`)
            }
            if (path === '/sitemap.xml') {
                return respond(request, response, 200, 'application/xml', `<sitemapindex><sitemap><loc>${origin}/sitemap-pages.xml</loc></sitemap></sitemapindex>`)
            }
            if (path === '/sitemap-pages.xml') {
                return respond(request, response, 200, 'application/xml', `<urlset><url><loc>${origin}/</loc></url><url><loc>${origin}/sitemap-only</loc></url></urlset>`)
            }
            if (path === '/llm.txt') return respond(request, response, 200, 'text/plain', '# Local SEO fixture\n')
            if (path === '/redirect') {
                return respond(request, response, 302, 'text/plain', '', { location: '/landing', 'x-fixture-hop': 'internal' })
            }
            if (path === '/manual.pdf') return respond(request, response, 200, 'application/pdf', '%PDF-1.4\n')
            if (path === '/server-error') return respond(request, response, 503, 'text/plain', 'Unavailable')
            if (!pages.has(path)) return respond(request, response, 404, 'text/plain', 'Missing')
            const headers = path === '/' ? { 'set-cookie': 'seo_fixture=local; Path=/' }
                : path === '/noindex' ? { 'x-robots-tag': 'noindex' }
                    : path === '/landing' ? { 'x-fixture-final': 'true', 'x-api-key': 'test-value' } : {}
            respond(request, response, 200, 'text/html; charset=utf-8', pages.get(path), headers)
        })
    } catch (error) {
        await close(external)
        throw error
    }
    return {
        origin: originOf(site), externalOrigin, requests,
        holdSiteResponse: path => {
            const arrived = Promise.withResolvers()
            const gate = Promise.withResolvers()
            held.set(path, { started: arrived.resolve, wait: gate.promise, release: gate.resolve })
            return {
                started: arrived.promise,
                release: () => { held.delete(path); gate.resolve() }
            }
        },
        close: async () => {
            for (const gate of held.values()) gate.release()
            await Promise.all([close(site), close(external)])
        }
    }
}

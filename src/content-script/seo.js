import { extensionApi } from '../platform/extensionApi.js'
import { collectMetaTags } from '../utils/seoDom.js'
import { collectSeoReport, getSeoMeta } from '../utils/seoReport.js'
import { getSeoActions, setSeoAction, setSeoAnnotations } from './seoActions.js'
import { captureHeadings, captureImages, focusHeading, focusImage } from './seoElementNavigation.js'
import { withoutFragment } from '../utils/linkCheckStatus.js'
import { collectPageWeight } from './pageWeight.js'
import { collectCwv } from '../utils/cwv.js'
const documentId = [...crypto.getRandomValues(new Uint32Array(4))].join('-')
/**
 * SEO-анализ текущей страницы.
 * Выполняется в контексте content script (доступ к DOM).
 * Интерфейс расширения отдельно запрашивает robots.txt, sitemap и ответы HTTP
 * через фоновый процесс.
 * Внедряется в страницу как IIFE из utils/seoClient.js; обработчики сообщений — ниже.
 */

const collectLiveReport = payload => {
    const report = collectSeoReport(document, location.href, { ...payload, images: captureImages(), source: 'tab' })
    captureHeadings()
    return { ...report, documentId, actions: getSeoActions(), pageWeight: collectPageWeight(document), cwv: collectCwv() }
}

const registerSeoHandler = () => {
    extensionApi.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (message?.type === 'seo:context') {
            sendResponse({ ok: true, data: { documentId, url: location.href, actions: getSeoActions() } })
            return false
        }
        if (message?.type === 'seo:social') {
            sendResponse({ ok: true, data: {
                url: location.href,
                baseUrl: document.baseURI,
                title: document.title.trim(),
                description: getSeoMeta(document, 'head meta[name="description" i]'),
                metaTags: collectMetaTags(document.head).filter(tag => /^(?:og|twitter):/i.test(tag.name))
            } })
            return false
        }
        if (message?.type === 'seo:heading') {
            try { sendResponse({ ok: true, data: focusHeading(message.payload || {}) }) }
            catch (error) { sendResponse({ ok: false, error: error.message }) }
            return false
        }
        if (message?.type === 'seo:image') {
            try {
                if (message.payload?.documentId !== documentId) throw new Error('Страница изменилась. Обновите SEO-анализ.')
                sendResponse({ ok: true, data: focusImage(message.payload) })
            } catch (error) { sendResponse({ ok: false, error: error.message }) }
            return false
        }
        if (message?.type === 'seo:action') {
            try {
                if (message.payload?.documentId && message.payload.documentId !== documentId) throw new Error('Страница изменилась. Обновите SEO-анализ.')
                sendResponse({ ok: true, data: setSeoAction(message.payload) })
            } catch (error) { sendResponse({ ok: false, error: error.message }) }
            return false
        }
        if (message?.type === 'seo:annotations') {
            try {
                if (withoutFragment(message.payload.url) !== withoutFragment(location.href)) throw new Error('Исходная страница изменилась.')
                sendResponse({ ok: true, data: setSeoAnnotations(message.payload.actions) })
            }
            catch (error) { sendResponse({ ok: false, error: error.message }) }
            return false
        }
        if (message?.type === 'seo:dom') {
            try { sendResponse({ ok: true, data: collectLiveReport(message.payload || {}) }) }
            catch (error) { sendResponse({ ok: false, error: error.message }) }
            return false
        }
        if (message?.type === 'seo:cwv') {
            try { sendResponse({ ok: true, data: { documentId, cwv: collectCwv() } }) }
            catch (error) { sendResponse({ ok: false, error: error.message }) }
        }
        return false
    })
}

if (!globalThis.__sup5thSeoRegistered) {
    globalThis.__sup5thSeoRegistered = true
    registerSeoHandler()
}

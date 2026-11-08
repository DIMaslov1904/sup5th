<script setup>
import { computed, onBeforeUnmount, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { extensionApi } from '../../platform/extensionApi.js'
import { sendSeoToTab, withActiveTab, fetchSeo, openSeoApp, openSocialPreview, canPinSeoPage, pinSeoPage } from '../../utils/seoClient.js'
import { loadSeoHtml } from '../../utils/seoHtml.js'
import { SeoTabUnavailableError } from '../../utils/seoMessaging.js'
import { callBackground } from '../../utils/backgroundClient.js'
import { SEO_SECTIONS, normalizeSeoSection } from '../../utils/seoSections.js'
import { SEO_ANNOTATIONS } from '../../utils/seoAnnotations.js'
import { evaluateHttpStatus } from '../../utils/seoValidation.js'
import { loadSeoNetwork, requestWithHeadFallback } from '../../utils/seoNetwork.js'
import { buildHeadingTree } from '../../utils/headingTree.js'
import HeadingTree from './HeadingTree.vue'
import { evaluateRobotsFile } from '../../utils/seoRules.js'
import { classifyLinkCheck, withoutFragment } from '../../utils/linkCheckStatus.js'
import Preloader from './ui/Preloader.vue'
import Button from './ui/Button.vue'
import Card from './ui/Card.vue'
import EmptyState from './ui/EmptyState.vue'
import Notification from './ui/Notification.vue'
import Tabs from './ui/Tabs.vue'
import Input from './ui/Input.vue'
import Select from './ui/Select.vue'
import PropertyList from './ui/PropertyList.vue'
import YandexCounter from './YandexCounter.vue'
import SeoOverview from './SeoOverview.vue'
import SeoImagePreview from './SeoImagePreview.vue'
import SeoToolIcon from './SeoToolIcon.vue'
import CopyButton from './ui/CopyButton.vue'

const props = defineProps({ tab: Object, manualUrl: String, session: Object, initialSection: { type: String, default: '' }, expanded: Boolean, docked: Boolean })
const emit = defineEmits(['section-change', 'annotations-change'])
const notification = ref('')
const pinning = ref(false)
const pin = async () => {
    if (pinning.value) return
    pinning.value = true
    try { await pinSeoPage(props.tab, section.value) }
    catch (reason) { if (alive) error.value = reason.message }
    finally { if (alive) pinning.value = false }
}
const headingTree = computed(() => buildHeadingTree(report.value?.headingRows || []))
const section = ref(normalizeSeoSection(props.initialSection)), report = shallowRef(null), loading = ref(true), error = ref('')
const unavailable = ref('')
const linkFilter = ref('all'), relFilter = ref('all'), protocolFilter = ref('all'), statusFilter = ref('all'), imageFilter = ref('all'), query = ref(''), visible = ref(100)
const checked = shallowRef({}), checking = ref(false), checkProgress = ref(0), checkTotal = ref(0)
const metaItems = tags => tags.map(item => ({ label: item.name, value: item.content, warning: item.inHead === false ? 'вне head' : '' }))
const openGraphMeta = computed(() => metaItems((report.value?.metaTags || []).filter(item => /^og:/i.test(item.name))))
const twitterMeta = computed(() => {
    const twitter = report.value?.twitter || {}
    return Object.entries(twitter).filter(([, value]) => value).map(([field, value]) => ({ label: `twitter:${field}`, value }))
})
let cancelled = false, alive = true, scanRevision = 0
let sessionContext = null, restoring = false
const tabs = SEO_SECTIONS
watch(section, value => emit('section-change', value))
watch(() => props.initialSection, value => { if (value) section.value = normalizeSeoSection(value) })
const selectSection = () => { visible.value = 100; notification.value = '' }
const enrich = (data, revision) => {
    loadSeoNetwork(data, (url, method, options) => fetchSeo(url, method, undefined, options), patch => {
        if (alive && revision === scanRevision) report.value = { ...report.value, ...patch }
    }).catch(reason => { if (alive && revision === scanRevision) error.value = reason.message })
}
const refreshCwv = async revision => {
    try {
        const { documentId, cwv } = await sendSeoToTab(props.tab?.id, 'seo:cwv')
        if (alive && revision === scanRevision && cwv && report.value?.documentId === documentId) {
            report.value = { ...report.value, cwv }
        }
    } catch { /* Keep the measurement from the DOM snapshot. */ }
}
const scan = async () => {
    if (loading.value) return
    const revision = ++scanRevision
    loading.value = true; error.value = ''
    notification.value = ''; unavailable.value = ''
    try {
        const data = props.manualUrl ? await loadSeoHtml(props.manualUrl)
            : await withActiveTab(props.tab?.id, () => sendSeoToTab(props.tab?.id, 'seo:dom'))
        if (alive) {
            if (props.tab) sessionContext = { tabId: props.tab.id, url: data.url, documentId: data.documentId }
            report.value = data; checked.value = {}; checkProgress.value = 0; checkTotal.value = 0; visible.value = 100
            if (props.docked) emit('annotations-change', props.tab.id, data.actions)
            enrich(data, revision)
            if (!props.manualUrl) refreshCwv(revision)
        }
    }
    catch (e) {
        if (!alive) return
        if (e instanceof SeoTabUnavailableError) unavailable.value = e.message
        else error.value = e.message
    }
    finally { if (alive) loading.value = false }
}
let persistTimer, reportDirty = false
const uiSnapshot = () => ({ section: section.value,
    linkFilter: linkFilter.value, relFilter: relFilter.value, protocolFilter: protocolFilter.value,
    statusFilter: statusFilter.value, imageFilter: imageFilter.value, query: query.value,
    visible: visible.value, checked: checked.value, checkProgress: checkProgress.value, checkTotal: checkTotal.value })
const persist = () => {
    clearTimeout(persistTimer)
    if (!alive || restoring || !sessionContext || !report.value) return
    const patch = uiSnapshot()
    if (reportDirty) patch.report = report.value
    props.session?.save(sessionContext, JSON.parse(JSON.stringify(patch)))
    reportDirty = false
}
const schedulePersist = () => { clearTimeout(persistTimer); persistTimer = setTimeout(persist, 200) }
watch(report, () => { if (!restoring) { reportDirty = true; schedulePersist() } }, { flush: 'sync' })
watch([section, linkFilter, relFilter, protocolFilter, statusFilter, imageFilter, query, visible, checked, checkProgress, checkTotal], schedulePersist)
onBeforeUnmount(persist)
onMounted(async () => {
    if (props.session && props.tab?.id) {
        loading.value = true
        try {
            const context = await sendSeoToTab(props.tab.id, 'seo:context')
            sessionContext = { tabId: props.tab.id, url: context.url, documentId: context.documentId }
            const saved = await props.session.load(sessionContext)
            if (!alive) return
            if (saved?.report) {
                restoring = true
                const cwv = saved.report.cwv?.supported ? saved.report.cwv : null
                report.value = { ...saved.report, actions: context.actions, cwv }
                section.value = normalizeSeoSection(props.initialSection || saved.section)
                linkFilter.value = saved.linkFilter || 'all'; relFilter.value = saved.relFilter || 'all'
                protocolFilter.value = saved.protocolFilter || 'all'; statusFilter.value = saved.statusFilter || 'all'
                imageFilter.value = saved.imageFilter || 'all'; query.value = saved.query || ''
                visible.value = saved.visible || 100; checked.value = saved.checked || {}; checkProgress.value = saved.checkProgress || 0
                checkTotal.value = saved.checkTotal || 0
                restoring = false
            }
        } catch (reason) {
            if (alive && reason instanceof SeoTabUnavailableError) unavailable.value = reason.message
        }
        finally { if (alive) loading.value = false }
    }
    loading.value = false
    if (!alive) return
    if (!report.value) {
        if (!unavailable.value) scan()
        return
    }
    const revision = ++scanRevision
    const { response, robotsFile, sitemap, llmTxt } = report.value
    if ([response, robotsFile, sitemap, llmTxt].some(item => item?.pending)) enrich(report.value, revision)
    refreshCwv(revision)
})
onUnmounted(() => { alive = false; cancelled = true; clearTimeout(persistTimer) })
const links = computed(() => (report.value?.linkRows || []).filter(item => {
    const info = checked.value[item.url]
    return (linkFilter.value === 'all' || (linkFilter.value === 'external' ? item.external : !item.external)) &&
        (relFilter.value === 'all' || (relFilter.value === 'follow' ? !item.nofollow : item.rel.split(/\s+/).includes(relFilter.value))) &&
        (protocolFilter.value === 'all' || item.protocol === protocolFilter.value) &&
        (statusFilter.value === 'all' || (statusFilter.value === 'broken' ? info?.outcome === 'broken' : statusFilter.value === 'redirect' ? info?.redirected : statusFilter.value === 'uncertain' ? info && ['unknown','auth','blocked','server'].includes(info.outcome) : !info)) &&
        `${item.text} ${item.url}`.toLowerCase().includes(query.value.toLowerCase())
}))
const images = computed(() => (report.value?.imageRows || []).filter(item => imageFilter.value === 'all' || (imageFilter.value === 'missing' ? item.alt === null : imageFilter.value === 'empty' ? item.alt === '' : Boolean(item.alt))))
const robotsRules = computed(() => report.value ? evaluateRobotsFile(report.value.robotsFile, report.value.url) : null)
const robotsRuleText = computed(() => (robotsRules.value?.rules || []).map(item => `${item.directive}: ${item.value}`).join(', '))
const checkLinks = async () => {
    if (checking.value) return
    checking.value = true; cancelled = false; error.value = ''; checkProgress.value = 0
    const urls = [...new Set(links.value.filter(item => /^https?:/.test(item.url)).map(item => item.url))]
    checkTotal.value = urls.length
    try {
        for (let i = 0; i < urls.length && !cancelled; i += 5) {
            await Promise.all(urls.slice(i, i + 5).map(async url => {
                let info
                try { info = await requestWithHeadFallback((target, method) => fetchSeo(target, method, 1000, { timeout: 10000 }), url) }
                catch { info = { ok: false, status: 0, url, failure: 'network' } }
                if (cancelled || !alive) return
                checked.value = { ...checked.value, [url]: { ok: info.ok, status: info.status, url: info.url, ...classifyLinkCheck(info), redirected: Boolean(info.url && withoutFragment(info.url) !== withoutFragment(url)) } }
                checkProgress.value++
            }))
        }
    } catch (e) { if (alive) error.value = e.message }
    finally { if (alive) checking.value = false }
}
const toggle = async (action) => {
    const revision = scanRevision
    const { actions: previous, documentId } = report.value
    const enabled = !previous[action]
    const tabId = props.tab.id
    if (props.docked && SEO_ANNOTATIONS.includes(action)) emit('annotations-change', tabId, { ...previous, [action]: enabled }, action)
    try {
        const actions = await sendSeoToTab(tabId, 'seo:action', { action, enabled, documentId })
        if (alive && revision === scanRevision) report.value = { ...report.value, actions }
    } catch (e) { if (alive && revision === scanRevision) error.value = e.message }
}
const goToHeading = async item => {
    notification.value = ''; error.value = ''
    try {
        const result = await sendSeoToTab(props.tab.id, 'seo:heading', { id: item.id })
        if (result.hidden) notification.value = 'Заголовок скрыт на странице. Прокрутка к нему невозможна.'
    } catch (reason) { error.value = reason.message }
}
const goToImage = async ({ id, src }) => {
    notification.value = ''; error.value = ''
    const tabId = props.tab.id, documentId = report.value.documentId, revision = scanRevision
    try {
        const result = await withActiveTab(tabId, () => sendSeoToTab(tabId, 'seo:image', { id, src, documentId }))
        if (!alive || revision !== scanRevision) return
        if (result.hidden) {
            notification.value = 'Изображение скрыто на странице. Прокрутка к нему невозможна.'
        } else if (props.expanded) {
            await extensionApi.tabs.update(tabId, { active: true })
        }
    } catch (reason) { if (alive && revision === scanRevision) error.value = reason.message }
}
const downloadImage = async url => {
    try { await callBackground('seo:downloadImage', { url }) }
    catch (reason) { error.value = reason.message }
}
const expand = async () => {
    persist()
    try { await openSeoApp(props.tab.id, 'overview', section.value) }
    catch (reason) { error.value = reason.message }
}
const previewLinks = async () => {
    try { await openSocialPreview(props.tab?.id, report.value?.requestedUrl) }
    catch (reason) { error.value = reason.message }
}
const linkStatusClass = info => ({ success: 'text-ui-success', warning: 'text-ui-warning', danger: 'text-ui-danger' })[evaluateHttpStatus(info.status, info.redirected).status]
const tools = computed(() => {
    if (!report.value) return []
    const url = encodeURIComponent(report.value.url), host = encodeURIComponent(new URL(report.value.url).hostname), title = encodeURIComponent('"' + report.value.title + '"')
    return [
        ['PageSpeed Insights',`https://pagespeed.web.dev/analysis?url=${url}`],
        ['Валидатор HTML',`https://validator.w3.org/nu/?doc=${url}`],
        ['Валидатор CSS',`https://jigsaw.w3.org/css-validator/validator?uri=${url}`],
        ['Schema.org',`https://validator.schema.org/#url=${url}`],
        ['Google Rich Results',`https://search.google.com/test/rich-results?url=${url}`],
        ['WHOIS',`https://www.whois.com/whois/${host}`],
        ['SSL',`https://www.ssllabs.com/ssltest/analyze.html?d=${host}`],
        ['Webarchive',`https://web.archive.org/web/*/${report.value.url}`],
        ['Веб-архив.ру',`https://web-arhive.ru/search?url=${url}&hidden=0`],
        ['Яндекс Вебмастер', 'https://webmaster.yandex.ru/sites/'],
        ['Индексация в Яндексе',`https://yandex.ru/search/?text=${encodeURIComponent('url:' + report.value.url)}`],
        ['Дубли Title в Яндексе',`https://yandex.ru/search/?text=${title}`],
        ['Индексация в Google',`https://www.google.com/search?q=${encodeURIComponent('site:' + report.value.url)}`],
        ['Дубли Title в Google',`https://www.google.com/search?q=${title}`]
    ]
})
</script>
<template>
    <div class="flex flex-1 flex-col gap-3 text-ui-text">
        <Notification v-if="error" :text="error" />
        <Notification v-if="notification" type="warning" :text="notification" />
        <Preloader v-if="loading" :label="manualUrl ? 'Загружаем HTML…' : 'Получаем данные страницы…'" />
        <EmptyState v-else-if="unavailable"
            :title="report ? 'Не удалось обновить анализ.' : (expanded ? 'Страница недоступна для анализа.' : 'Страница недоступна.')"
            :description="expanded ? unavailable : ''" />
        <div v-if="report" class="grid min-w-0 gap-3">
        <p v-if="manualUrl" class="text-xs text-ui-muted">Анализ исходного HTML без выполнения JavaScript.</p>
        <Tabs v-model="section" :items="tabs" label="Разделы SEO" wrap @update:model-value="selectSection" />
        <Transition name="ui-view" mode="out-in"><div :key="section" class="grid min-w-0 gap-3">
            <template v-if="section === 'overview'">
                <SeoOverview :report="report" :hide-unavailable-metrics="expanded && !docked" />
            </template>
            <template v-if="section === 'headings'">
                <Button v-if="!manualUrl" size="sm" variant="secondary" @click="toggle('headings')">{{ report.actions.headings ? 'Убрать подсветку' : 'Подсветить H1–H6' }}</Button>
                <p class="text-xs text-ui-muted">H1: {{ report.h1Count }} · Дубли H1: {{ report.duplicateH1.length }}</p>
                <HeadingTree :nodes="headingTree" :interactive="!manualUrl" @select="goToHeading" />
            </template>
            <template v-if="section === 'links'">
                <div class="grid grid-cols-2 gap-2 text-xs">
                    <Select v-model="linkFilter" aria-label="Тип ссылок"><option value="all">Все ссылки</option><option value="internal">Внутренние</option><option value="external">Внешние</option></Select>
                    <Select v-model="relFilter" aria-label="Rel ссылок"><option value="all">Все rel</option><option value="follow">Follow</option><option>nofollow</option><option>ugc</option><option>sponsored</option></Select>
                    <Select v-model="protocolFilter" aria-label="Протокол ссылок"><option value="all">Все протоколы</option><option value="https:">HTTPS</option><option value="http:">HTTP</option><option value="mailto:">Email</option><option value="tel:">Телефон</option></Select>
                    <Select v-model="statusFilter" aria-label="Статус ссылок"><option value="all">Все статусы</option><option value="broken">Битые: 404 / 410</option><option value="uncertain">Не удалось подтвердить</option><option value="redirect">Редиректы</option><option value="unchecked">Не проверены</option></Select>
                </div>
                <Input v-model="query" placeholder="Поиск по URL и анкору" />
                <div class="flex flex-wrap gap-2"><Button size="sm" variant="secondary" :disabled="checking" @click="checkLinks">Проверить ссылки</Button><Button v-if="checking" size="sm" variant="ghost" @click="cancelled = true">Остановить</Button><CopyButton :value="links.map(item => item.url).join('\n')" label="Копировать URL" /></div>
                <p class="text-xs text-ui-muted">Ссылок: {{ links.length }} · Проверено уникальных HTTP(S) URL: {{ checkProgress }}<template v-if="checkTotal"> из {{ checkTotal }}</template>. Проверка выполняется без cookies.</p>
                <article v-for="item in links.slice(0, visible)" :key="item.id" class="grid gap-1 ui-panel text-xs">
                    <a :href="/^https?:/.test(item.url) ? item.url : undefined" target="_blank" rel="noreferrer" class="break-all text-ui-accent">{{ item.url }}</a>
                    <span>{{ item.text || 'Без анкора' }}</span><span class="text-ui-muted">{{ item.external ? 'Внешняя' : 'Внутренняя' }} · {{ item.rel || 'follow' }} <b v-if="checked[item.url]" :class="linkStatusClass(checked[item.url])" :title="evaluateHttpStatus(checked[item.url].status, checked[item.url].redirected).hint">· {{ checked[item.url].label }}{{ checked[item.url].redirected ? ' → ' + checked[item.url].url : '' }}</b></span>
                </article>
                <Button v-if="links.length > visible" size="sm" variant="ghost" @click="visible += 100">Показать ещё</Button>
            </template>
            <template v-if="section === 'images'">
                <div class="flex items-center gap-2"><Select v-model="imageFilter" aria-label="Alt изображений" class="min-w-0 flex-1"><option value="all">Все изображения</option><option value="missing">Без атрибута alt</option><option value="empty">Пустой alt</option><option value="filled">Заполненный alt</option></Select><Button v-if="!manualUrl" size="sm" variant="secondary" @click="toggle('alt')">{{ report.actions.alt ? 'Убрать alt' : 'Показать alt' }}</Button></div>
                <Button v-if="!manualUrl" size="sm" variant="secondary" @click="toggle('downloads')">{{ report.actions.downloads ? 'Убрать ссылки скачивания' : 'Ссылки скачивания на странице' }}</Button>
                <p class="text-xs text-ui-muted">Всего: {{ report.images.total }} · Без alt: {{ report.images.withoutAlt }} · Пустой alt: {{ report.images.emptyAlt }}</p>
                <article v-for="item in images.slice(0,visible)" :key="item.id" class="relative isolate flex gap-3 ui-panel text-xs" :class="{ 'hover:bg-ui-raised': !manualUrl }">
                    <button v-if="!manualUrl" type="button" aria-label="Показать изображение на странице" title="Показать изображение на странице"
                        class="absolute inset-0 cursor-pointer rounded-panel focus-visible:outline-2 focus-visible:outline-ui-accent" @click="goToImage(item)"></button>
                    <div v-if="/^https?:/.test(item.src)" class="relative z-10 shrink-0 self-start">
                        <SeoImagePreview :src="item.src" :alt="item.alt" />
                    </div>
                    <div class="grid min-w-0 gap-1">
                        <a v-if="/^https?:/.test(item.src)" :href="item.src" target="_blank" rel="noreferrer" class="relative z-10 break-all text-ui-accent">{{ item.src }}</a>
                        <span v-else class="break-all text-ui-muted">{{ item.src || 'Источник отсутствует' }}</span>
                        <span>Alt: {{ item.alt === null ? 'Отсутствует' : item.alt || '(пустой)' }}</span>
                        <span>Title: {{ item.title || 'Нет' }}<template v-if="!manualUrl || item.width && item.height"> · {{ item.width }} × {{ item.height }}</template> · {{ item.loading || 'eager' }}</span>
                        <button v-if="/^https?:/.test(item.src)" type="button" class="relative z-10 w-fit cursor-pointer text-ui-accent hover:underline" @click="downloadImage(item.src)">Скачать</button>
                    </div>
                </article>
                <Button v-if="images.length > visible" size="sm" variant="ghost" @click="visible += 100">Показать ещё</Button>
            </template>
            <template v-if="section === 'markup'">
                <Card title="Open Graph"><PropertyList v-if="openGraphMeta.length" :items="openGraphMeta" /><p v-else class="text-xs text-ui-muted">Не найден</p></Card>
                <Card title="Twitter Cards"><PropertyList v-if="twitterMeta.length" :items="twitterMeta" /><p v-else class="text-xs text-ui-muted">Не найден</p></Card>
                <Button size="sm" variant="secondary" @click="previewLinks">Предпросмотр ссылок ↗</Button>
                <Card title="JSON-LD"><div v-for="(item,index) in report.jsonLd" :key="index" class="mb-2"><p class="text-xs" :class="item.valid ? 'text-ui-success' : 'text-ui-warning'">{{ item.valid ? 'Корректный JSON' : item.error }}</p><pre class="max-h-72 overflow-auto whitespace-pre-wrap break-all text-[11px]">{{ item.valid ? JSON.stringify(item.value,null,2) : item.raw }}</pre></div><p v-if="!report.jsonLd.length" class="text-xs text-ui-muted">Не найден</p></Card>
                <Card title="Microdata / RDFa"><pre class="max-h-72 overflow-auto whitespace-pre-wrap break-all text-[11px]">{{ JSON.stringify({ microdata: report.microdata, rdfa: report.rdfa },null,2) }}</pre></Card>
                <div class="flex flex-wrap gap-2"><a :href="tools.find(item => item[0] === 'Schema.org')?.[1]" target="_blank" rel="noreferrer" class="text-xs text-ui-accent">Валидатор Schema.org ↗</a><a :href="tools.find(item => item[0] === 'Google Rich Results')?.[1]" target="_blank" rel="noreferrer" class="text-xs text-ui-accent">Google Rich Results ↗</a></div>
            </template>
            <template v-if="section === 'index'">
                <Card title="Индекс качества сайта | Вебмастер"><YandexCounter :key="`${tab?.id}:${report.url}:${report.scannedAt}`" :page-url="report.url" /></Card>
                <Card title="Индексация"><div class="grid gap-2 text-xs"><p>Meta robots: {{ report.robots || 'Не задан' }}</p><p>X-Robots-Tag: {{ report.response.pending ? 'Проверяем…' : report.xRobots || 'Не задан' }}</p><p :class="report.robotsAllowed && report.xRobotsAllowed && robotsRules.allowed !== false ? 'text-ui-success' : 'text-ui-warning'">Noindex в meta/HTTP: {{ !report.robotsAllowed || report.xRobotsAllowed === false ? 'есть запрет' : report.response.pending ? 'Проверяем HTTP…' : report.xRobotsAllowed === null ? 'не определён: результат неполный' : robotsRules.allowed === false ? 'запрета нет, но обход закрыт robots.txt' : 'запрета нет' }}</p><p :class="robotsRules.allowed === false ? 'text-ui-warning' : ''">robots.txt: {{ report.robotsFile.pending ? 'Проверяем…' : report.robotsFile.exists ? 'HTTP ' + report.robotsFile.status : 'Недоступен' }} · {{ robotsRules.allowed === null ? 'Правила не удалось определить' : robotsRules.allowed ? 'Путь разрешён для *' : 'Путь запрещён для *' }}</p><p v-for="item in report.indexingAgents" :key="item.agent" :class="robotsRules.allowed === false ? 'text-ui-warning' : ''">{{ item.agent }}: {{ item.allowed === null ? 'область действия noindex неизвестна' : item.allowed ? 'запрета noindex не найдено' : 'есть запрет noindex' }}{{ report.xRobotsAllowed === null ? ' (HTTP-проверка неполная)' : '' }}{{ robotsRules.allowed === false ? ` · обход запрещён (${robotsRuleText})` : '' }}</p><p class="text-ui-muted">Отсутствие запрета не гарантирует индексацию. Правила конкретного робота могут отличаться.</p></div></Card>
                <a :href="report.robotsFile.url" target="_blank" rel="noreferrer" class="text-xs text-ui-accent">Открыть robots.txt ↗</a>
                <Card title="Canonical / hreflang"><p v-for="(item,index) in report.canonicals" :key="index" class="break-all text-xs">{{ item.href || '(пустой)' }} {{ item.inHead ? '' : 'вне head' }}</p><p v-for="(item,index) in report.hreflang" :key="index" class="break-all text-xs">{{ item.hreflang }}: {{ item.href }}</p></Card>
                <Button v-if="!expanded" variant="secondary" size="sm" @click="openSeoApp(tab.id,'sitemap')">Открыть единый sitemap ↗</Button>
            </template>
            <template v-if="section === 'page'">
                <template v-if="!manualUrl">
                    <p class="text-xs text-ui-muted">{{ docked ? 'Подсветки сохраняются при переходах в этой вкладке. Отключение CSS действует на текущей странице.' : 'Изменения действуют только на этой странице до выключения или её закрытия/перезагрузки.' }}</p>
                    <Button v-for="[action,label] in [['external','Внешние ссылки'],['noindex','Noindex / nofollow'],['headings','Заголовки H1–H6'],['alt','Alt изображений'],['downloads','Ссылки скачивания изображений'],['css','Отключить CSS']]" :key="action" size="sm" variant="secondary" @click="toggle(action)">{{ report.actions[action] ? '✓ ' : '' }}{{ label }}</Button>
                </template>
                <Card title="Статистика текста"><p class="text-xs">Слов: {{ report.statistics.words }} · Символов: {{ report.statistics.characters }} · Без пробелов: {{ report.statistics.withoutSpaces }}</p><p v-if="!manualUrl" class="text-xs">Выделенный текст: {{ report.statistics.selection.words }} слов, {{ report.statistics.selection.characters }} символов</p>
                    <details v-for="[key,label] in [['top','Частые слова'],['bigrams','Биграммы'],['withoutAnchors','Без анкоров'],['anchors','Анкоры'],['imageText','Alt и title изображений']]" :key="key" class="mt-3 text-xs"><summary class="cursor-pointer text-ui-accent">{{ label }}</summary><p v-for="row in (Array.isArray(report.statistics[key]) ? report.statistics[key] : report.statistics[key].top)" :key="row.word">{{ row.word }} — {{ row.count }} ({{ row.density }}%)</p></details>
                </Card>
            </template>
            <div v-if="section === 'tools'" class="grid gap-2"><a v-for="[label,url] in tools" :key="label" :href="url" target="_blank" rel="noreferrer" class="ui-panel flex min-h-16 items-center gap-3 py-3 text-xs text-ui-accent hover:bg-ui-raised"><SeoToolIcon :label="label" /><span class="min-w-0 flex-1">{{ label }}</span><span aria-hidden="true">↗</span></a></div>
        </div></Transition>
        </div>
        <div class="sticky bottom-0 z-20 -mx-1 mt-auto flex shrink-0 flex-wrap gap-2 rounded-panel border border-ui-border bg-ui-panel px-2 py-2 shadow-sm">
            <Button size="sm" variant="secondary" :disabled="(!tab?.id && !manualUrl) || loading || checking" @click="scan">Обновить</Button>
            <Button v-if="canPinSeoPage && !docked && !manualUrl" size="sm" variant="ghost" :disabled="!tab?.id || pinning" @click="pin">Закрепить</Button>
            <Button v-if="!expanded" size="sm" variant="ghost" :disabled="!tab?.id" @click="expand">На весь экран ↗</Button>
            <Button v-if="!expanded" size="sm" variant="ghost" :disabled="!tab?.id" @click="openSeoApp(tab.id)">Аудит ↗</Button>
        </div>
    </div>
</template>

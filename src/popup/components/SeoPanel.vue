<script setup>
import { computed, onBeforeUnmount, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { callBackground, sendSeoToTab, fetchSeo, openSeoApp, downloadText } from '../../utils/seoClient.js'
import { buildHeadingTree } from '../../utils/headingTree.js'
import HeadingTree from './HeadingTree.vue'
import { evaluateRobotsFile } from '../../utils/seoRules.js'
import { classifyLinkCheck, withoutFragment } from '../../utils/linkCheckStatus.js'
import Preloader from './ui/Preloader.vue'
import Button from './ui/Button.vue'
import Card from './ui/Card.vue'
import Message from './ui/Message.vue'
import Notification from './ui/Notification.vue'
import Tabs from './ui/Tabs.vue'
import Input from './ui/Input.vue'
import Select from './ui/Select.vue'
import PropertyList from './ui/PropertyList.vue'
import OpenGraphPreview from './OpenGraphPreview.vue'
import { pageWeightRows } from '../../utils/pageWeightDisplay.js'
import { useColorScheme } from '../useColorScheme.js'
import { yandexCounterUrl } from '../../utils/yandexCounter.js'
const theme = useColorScheme()

const props = defineProps({ tab: Object, autoScan: { type: Boolean, default: true }, session: Object })
const notification = ref(''), serverIp = ref(''), serverIpLoading = ref(false)
const headingTree = computed(() => buildHeadingTree(report.value?.headingRows || []))
const section = ref('overview'), report = shallowRef(null), loading = ref(true), error = ref('')
const linkFilter = ref('all'), relFilter = ref('all'), protocolFilter = ref('all'), statusFilter = ref('all'), imageFilter = ref('all'), query = ref(''), visible = ref(100)
const checked = shallowRef({}), checking = ref(false), checkProgress = ref(0)
const ogPreviewOpen = ref(false)
const metaItems = tags => tags.map(item => ({ label: item.name, value: item.content, warning: item.inHead === false ? 'вне head' : '' }))
const allMeta = computed(() => metaItems(report.value?.metaTags || []))
const openGraphMeta = computed(() => metaItems((report.value?.metaTags || []).filter(item => /^og:/i.test(item.name))))
let cancelled = false, alive = true, scanRevision = 0
let sessionContext = null, restoring = false
const tabs = [['overview','Обзор'],['headings','Заголовки'],['links','Ссылки'],['images','Изображения'],['markup','Разметка'],['index','Индексация'],['page','Страница'],['tools','Инструменты']]
const selectSection = () => { visible.value = 100; notification.value = '' }
const scan = async () => {
    if (loading.value) return
    const revision = ++scanRevision
    loading.value = true; error.value = ''
    notification.value = ''; serverIp.value = ''
    try {
        const context = await sendSeoToTab(props.tab?.id, 'seo:context')
        sessionContext = { tabId: props.tab.id, url: context.url, documentId: context.documentId }
        const data = await sendSeoToTab(props.tab?.id)
        if (alive) {
            report.value = data; checked.value = {}; visible.value = 100
            serverIpLoading.value = true
            callBackground('seo:serverIp', { url: data.finalUrl || data.url }).then(result => { if (alive && revision === scanRevision) serverIp.value = result.address || '' }).catch(() => {}).finally(() => { if (alive && revision === scanRevision) serverIpLoading.value = false })
        }
    }
    catch (e) { if (alive) error.value = e.message }
    finally { if (alive) loading.value = false }
}
let persistTimer, reportDirty = false
const uiSnapshot = () => ({ section: section.value, serverIp: serverIp.value,
    linkFilter: linkFilter.value, relFilter: relFilter.value, protocolFilter: protocolFilter.value,
    statusFilter: statusFilter.value, imageFilter: imageFilter.value, query: query.value,
    visible: visible.value, checked: checked.value, checkProgress: checkProgress.value })
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
watch([section, serverIp, linkFilter, relFilter, protocolFilter, statusFilter, imageFilter, query, visible, checked, checkProgress], schedulePersist)
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
                report.value = { ...saved.report, actions: context.actions }
                section.value = tabs.some(([name]) => name === saved.section) ? saved.section : 'overview'
                serverIp.value = saved.serverIp || ''
                linkFilter.value = saved.linkFilter || 'all'; relFilter.value = saved.relFilter || 'all'
                protocolFilter.value = saved.protocolFilter || 'all'; statusFilter.value = saved.statusFilter || 'all'
                imageFilter.value = saved.imageFilter || 'all'; query.value = saved.query || ''
                visible.value = saved.visible || 100; checked.value = saved.checked || {}; checkProgress.value = saved.checkProgress || 0
                restoring = false
            }
        } catch { /* Нет доступного content script/кеша — обычная проверка ниже. */ }
        finally { if (alive) loading.value = false }
    }
    loading.value = false
    if (alive && props.autoScan && !report.value) scan()
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
const checkLinks = async () => {
    if (checking.value) return
    checking.value = true; cancelled = false; error.value = ''; checkProgress.value = 0
    const urls = [...new Set(links.value.filter(item => /^https?:/.test(item.url)).map(item => item.url))]
    try {
        for (let i = 0; i < urls.length && !cancelled; i += 5) {
            const batch = await Promise.all(urls.slice(i, i + 5).map(async url => {
                let info = await fetchSeo(url, 'HEAD'); if (!info.ok && [0, 405, 501].includes(info.status)) info = await fetchSeo(url)
                return [url, { ok: info.ok, status: info.status, url: info.url, ...classifyLinkCheck(info), redirected: Boolean(info.url && withoutFragment(info.url) !== withoutFragment(url)) }]
            }))
            if (cancelled || !alive) break
            checked.value = { ...checked.value, ...Object.fromEntries(batch) }; checkProgress.value += batch.length
        }
    } catch (e) { if (alive) error.value = e.message }
    finally { if (alive) checking.value = false }
}
const toggle = async (action) => {
    try { report.value = { ...report.value, actions: await sendSeoToTab(props.tab.id, 'seo:action', { action, enabled: !report.value.actions[action] }) } }
    catch (e) { error.value = e.message }
}
const goToHeading = async item => {
    notification.value = ''; error.value = ''
    try {
        const result = await sendSeoToTab(props.tab.id, 'seo:heading', { id: item.id })
        if (result.hidden) notification.value = 'Заголовок скрыт на странице. Прокрутка к нему невозможна.'
    } catch (reason) { error.value = reason.message }
}
const downloadImage = async url => {
    try { await callBackground('seo:downloadImage', { url }) }
    catch (reason) { error.value = reason.message }
}
const copyLinks = async () => { try { await navigator.clipboard.writeText(links.value.map(item => item.url).join('\n')) } catch (e) { error.value = e.message } }
const exportLinks = () => {
    const cell = value => `"${String(value ?? '').replaceAll('"', '""')}"`
    downloadText('\uFEFF' + [['URL','Анкор','Rel','HTTP'], ...links.value.map(item => [item.url,item.text,item.rel,checked.value[item.url]?.status])].map(row => row.map(cell).join(';')).join('\r\n'), 'links.csv', 'text/csv;charset=utf-8')
}
const overview = computed(() => report.value ? [
    ['URL',report.value.url], ['Base',report.value.baseDisplay + (report.value.baseDeclared ? '' : ' (не задан)')], ['Проверено',new Date(report.value.scannedAt).toLocaleString('ru-RU')], ['IP сервера',serverIpLoading.value ? 'Определяем…' : serverIp.value || 'Не получен'], ['HTTP',report.value.response.status || 'Не получен'], ['Title',report.value.title || 'Отсутствует'], ['Длина Title',report.value.titleLength],
    ['Description',report.value.description || 'Отсутствует'], ['Длина Description',report.value.descriptionLength], ['Keywords',report.value.keywords || 'Отсутствует'],
    ['Язык',report.value.lang || 'Не указан'], ['Canonical',report.value.canonical || 'Не указан'], ['Viewport',report.value.viewport ? 'Есть' : 'Нет'],
    ['Редирект',report.value.redirected ? report.value.finalUrl : 'Нет'], ['TTFB повторного запроса',report.value.response.ttfb == null ? 'Не измерен' : report.value.response.ttfb + ' мс']
].map(([label,value]) => ({ label, value })).concat(pageWeightRows(report.value.pageWeight)) : [])
const yandexCounter = computed(() => report.value ? yandexCounterUrl(report.value.url, theme.value) : '')
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
        ['Яндекс Вебмастер', 'https://webmaster.yandex.ru/sites/'],
        ['Индексация в Яндексе',`https://yandex.ru/search/?text=${encodeURIComponent('url:' + report.value.url)}`],
        ['Дубли Title в Яндексе',`https://yandex.ru/search/?text=${title}`],
        ['Индексация в Google',`https://www.google.com/search?q=${encodeURIComponent('site:' + report.value.url)}`], 
        ['Дубли Title в Google',`https://www.google.com/search?q=${title}`]
    ]
})
</script>
<template>
    <div class="grid gap-3 text-ui-text">
        <Notification v-if="error" :text="error" />
        <Notification v-if="notification" type="warning" :text="notification" />
        <Preloader v-if="loading" label="Получаем данные страницы…" />
        <div v-if="report" class="grid min-w-0 gap-3">
        <Tabs v-model="section" :items="tabs" label="Разделы SEO" wrap @update:model-value="selectSection" />
        <div class="grid min-w-0 gap-3">
            <template v-if="section === 'overview'">
                <Card title="Метаданные страницы">
                    <PropertyList :items="overview" />
                    <div class="mt-3 grid gap-1 text-xs"><span class="text-ui-muted/70">Яндекс ИКС</span><img :src="yandexCounter" alt="Яндекс ИКС" class="rounded-lg" /></div>
                </Card>
                <Message v-if="report.titles.length !== 1 || report.canonicals.length > 1 || report.metaTags.some(item => !item.inHead)" type="error">Проверьте количество Title/Canonical и расположение метатегов: есть дубли или теги вне head.</Message>
                <details class="ui-panel text-xs"><summary class="cursor-pointer">Все метатеги ({{ report.metaTags.length }})</summary><PropertyList :items="allMeta" class="mt-3" /></details>
            </template>
            <template v-if="section === 'headings'">
                <Button size="sm" variant="secondary" @click="toggle('headings')">{{ report.actions.headings ? 'Убрать подсветку' : 'Подсветить H1–H6' }}</Button>
                <p class="text-xs text-ui-muted">H1: {{ report.h1Count }} · Дубли H1: {{ report.duplicateH1.length }}</p>
                <HeadingTree :nodes="headingTree" @select="goToHeading" />
            </template>
            <template v-if="section === 'links'">
                <div class="grid grid-cols-2 gap-2 text-xs">
                    <Select v-model="linkFilter" aria-label="Тип ссылок"><option value="all">Все ссылки</option><option value="internal">Внутренние</option><option value="external">Внешние</option></Select>
                    <Select v-model="relFilter" aria-label="Rel ссылок"><option value="all">Все rel</option><option value="follow">Follow</option><option>nofollow</option><option>ugc</option><option>sponsored</option></Select>
                    <Select v-model="protocolFilter" aria-label="Протокол ссылок"><option value="all">Все протоколы</option><option value="https:">HTTPS</option><option value="http:">HTTP</option><option value="mailto:">Email</option><option value="tel:">Телефон</option></Select>
                    <Select v-model="statusFilter" aria-label="Статус ссылок"><option value="all">Все статусы</option><option value="broken">Битые: 404 / 410</option><option value="uncertain">Не удалось подтвердить</option><option value="redirect">Редиректы</option><option value="unchecked">Не проверены</option></Select>
                </div>
                <Input v-model="query" placeholder="Поиск по URL и анкору" />
                <div class="flex flex-wrap gap-2"><Button size="sm" variant="secondary" :disabled="checking" @click="checkLinks">Проверить ссылки</Button><Button v-if="checking" size="sm" variant="ghost" @click="cancelled = true">Остановить</Button><Button size="sm" variant="ghost" @click="exportLinks">CSV</Button><Button size="sm" variant="ghost" @click="copyLinks">Копировать URL</Button></div>
                <p class="text-xs text-ui-muted">Ссылок: {{ links.length }} · Проверено: {{ checkProgress }}. Проверка выполняется без cookies.</p>
                <article v-for="item in links.slice(0, visible)" :key="item.id" class="grid gap-1 ui-panel text-xs">
                    <a :href="/^https?:/.test(item.url) ? item.url : undefined" target="_blank" rel="noreferrer" class="break-all text-ui-accent">{{ item.url }}</a>
                    <span>{{ item.text || 'Без анкора' }}</span><span class="text-ui-muted/70">{{ item.external ? 'Внешняя' : 'Внутренняя' }} · {{ item.rel || 'follow' }} <b v-if="checked[item.url]" :class="checked[item.url].ok ? 'text-ui-success' : 'text-ui-warning'">· {{ checked[item.url].label }}{{ checked[item.url].redirected ? ' → ' + checked[item.url].url : '' }}</b></span>
                </article>
                <Button v-if="links.length > visible" size="sm" variant="ghost" @click="visible += 100">Показать ещё</Button>
            </template>
            <template v-if="section === 'images'">
                <div class="flex items-center gap-2"><Select v-model="imageFilter" aria-label="Alt изображений" class="min-w-0 flex-1"><option value="all">Все изображения</option><option value="missing">Без атрибута alt</option><option value="empty">Пустой alt</option><option value="filled">Заполненный alt</option></Select><Button size="sm" variant="secondary" @click="toggle('alt')">{{ report.actions.alt ? 'Убрать alt' : 'Показать alt' }}</Button></div>
                <Button size="sm" variant="secondary" @click="toggle('downloads')">{{ report.actions.downloads ? 'Убрать ссылки скачивания' : 'Ссылки скачивания на странице' }}</Button>
                <p class="text-xs text-ui-muted">Всего: {{ report.images.total }} · Без alt: {{ report.images.withoutAlt }} · Пустой alt: {{ report.images.emptyAlt }}</p>
                <article v-for="item in images.slice(0,visible)" :key="item.id" class="flex gap-1 ui-panel text-xs">
                    <img v-if="/^https?:/.test(item.src)" :src="item.src" loading="lazy" class="size-6 object-contain shrink-0">
                    <div class="grid gap-1">
                        <a :href="/^https?:/.test(item.src) ? item.src : undefined" target="_blank" rel="noreferrer" class="break-all text-ui-accent">{{ item.src || 'Источник отсутствует' }}</a>
                        <span>Alt: {{ item.alt === null ? 'Отсутствует' : item.alt || '(пустой)' }}</span>
                        <span>Title: {{ item.title || 'Нет' }} · {{ item.width }} × {{ item.height }} · {{ item.loading || 'eager' }}</span>
                        <button v-if="/^https?:/.test(item.src)" type="button" class="w-fit cursor-pointer text-ui-accent hover:underline" @click="downloadImage(item.src)">Скачать</button>
                    </div>

                </article>
                <Button v-if="images.length > visible" size="sm" variant="ghost" @click="visible += 100">Показать ещё</Button>
            </template>
            <template v-if="section === 'markup'">
                <Card title="Open Graph"><PropertyList v-if="openGraphMeta.length" :items="openGraphMeta" /><p v-else class="text-xs text-ui-muted">Не найден</p></Card>
                <Button size="sm" variant="secondary" @click="ogPreviewOpen = true">Предпросмотр</Button>
                <OpenGraphPreview v-model:open="ogPreviewOpen" :report="report" />
                <Card title="JSON-LD"><div v-for="(item,index) in report.jsonLd" :key="index" class="mb-2"><p class="text-xs" :class="item.valid ? 'text-ui-success' : 'text-ui-warning'">{{ item.valid ? 'Корректный JSON' : item.error }}</p><pre class="max-h-72 overflow-auto whitespace-pre-wrap break-all text-[11px]">{{ item.valid ? JSON.stringify(item.value,null,2) : item.raw }}</pre></div><p v-if="!report.jsonLd.length" class="text-xs text-ui-muted">Не найден</p></Card>
                <Card title="Microdata / RDFa"><pre class="max-h-72 overflow-auto whitespace-pre-wrap break-all text-[11px]">{{ JSON.stringify({ microdata: report.microdata, rdfa: report.rdfa },null,2) }}</pre></Card>
                <div class="flex flex-wrap gap-2"><a :href="tools.find(item => item[0] === 'Schema.org')?.[1]" target="_blank" rel="noreferrer" class="text-xs text-ui-accent">Валидатор Schema.org ↗</a><a :href="tools.find(item => item[0] === 'Google Rich Results')?.[1]" target="_blank" rel="noreferrer" class="text-xs text-ui-accent">Google Rich Results ↗</a></div>
            </template>
            <template v-if="section === 'index'">
                <Card title="Индексация"><div class="grid gap-2 text-xs"><p>Meta robots: {{ report.robots || 'Не задан' }}</p><p>X-Robots-Tag: {{ report.xRobots || 'Не задан' }}</p><p :class="report.robotsAllowed && report.xRobotsAllowed ? 'text-ui-success' : 'text-ui-warning'">{{ !report.robotsAllowed || report.xRobotsAllowed === false ? 'Есть общий запрет noindex' : report.xRobotsAllowed === null ? 'HTTP-заголовки не получены: результат неполный' : 'Общего запрета noindex нет' }}</p><p>robots.txt: {{ report.robotsFile.exists ? 'HTTP ' + report.robotsFile.status : 'Недоступен' }} · {{ robotsRules.allowed === null ? 'Правила не удалось определить' : robotsRules.allowed ? 'Путь разрешён для *' : 'Путь запрещён для *' }}</p><p v-for="item in report.indexingAgents" :key="item.agent">{{ item.agent }}: {{ item.allowed ? 'запрета noindex не найдено' : 'есть запрет noindex' }}{{ report.xRobotsAllowed === null ? ' (HTTP-заголовки не получены)' : '' }}</p><p class="text-ui-muted/70">Отсутствие запрета не гарантирует индексацию. Правила конкретного робота могут отличаться.</p></div></Card>
                <details class="ui-panel text-xs"><summary class="cursor-pointer">robots.txt</summary><pre class="mt-2 overflow-auto whitespace-pre-wrap">{{ report.robotsFile.content || 'Пустой или не получен' }}</pre></details>
                <Card title="Canonical / hreflang"><p v-for="(item,index) in report.canonicals" :key="index" class="break-all text-xs">{{ item.href || '(пустой)' }} {{ item.inHead ? '' : 'вне head' }}</p><p v-for="(item,index) in report.hreflang" :key="index" class="break-all text-xs">{{ item.hreflang }}: {{ item.href }}</p></Card>
                <Button variant="secondary" size="sm" @click="openSeoApp(tab.id,'sitemap')">Открыть единый sitemap ↗</Button>
            </template>
            <template v-if="section === 'page'">
                <p class="text-xs text-ui-muted">Изменения действуют только на этой странице до выключения или её закрытия/перезагрузки.</p>
                <Button v-for="[action,label] in [['external','Внешние ссылки'],['noindex','Noindex / nofollow'],['headings','Заголовки H1–H6'],['alt','Alt изображений'],['downloads','Ссылки скачивания изображений'],['css','Отключить CSS']]" :key="action" size="sm" variant="secondary" @click="toggle(action)">{{ report.actions[action] ? '✓ ' : '' }}{{ label }}</Button>
                <Card title="Статистика текста"><p class="text-xs">Слов: {{ report.statistics.words }} · Символов: {{ report.statistics.characters }} · Без пробелов: {{ report.statistics.withoutSpaces }}</p><p class="text-xs">Выделенный текст: {{ report.statistics.selection.words }} слов, {{ report.statistics.selection.characters }} символов</p>
                    <details v-for="[key,label] in [['top','Частые слова'],['bigrams','Биграммы'],['withoutAnchors','Без анкоров'],['anchors','Анкоры'],['imageText','Alt и title изображений']]" :key="key" class="mt-3 text-xs"><summary class="cursor-pointer text-ui-accent">{{ label }}</summary><p v-for="row in (Array.isArray(report.statistics[key]) ? report.statistics[key] : report.statistics[key].top)" :key="row.word">{{ row.word }} — {{ row.count }} ({{ row.density }}%)</p></details>
                </Card>
            </template>
            <div v-if="section === 'tools'" class="grid gap-2"><a v-for="[label,url] in tools" :key="label" :href="url" target="_blank" rel="noreferrer" class="ui-panel text-xs text-ui-accent hover:bg-ui-raised">{{ label }} ↗</a></div>
        </div>
        </div>
        <div class="flex gap-2"><Button size="sm" variant="secondary" :disabled="!tab?.id || loading || checking" @click="scan">Обновить</Button><Button size="sm" variant="ghost" :disabled="!tab?.id" @click="openSeoApp(tab.id)">Аудит ↗</Button></div>
    </div>
</template>

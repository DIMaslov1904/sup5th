<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { sendSeoToTab, fetchSeo, openSeoApp, downloadText } from '../../utils/seoClient.js'
import { evaluateRobots } from '../../utils/seoRules.js'
import Button from './ui/Button.vue'
import Card from './ui/Card.vue'
import Message from './ui/Message.vue'

const props = defineProps({ tab: Object })
const section = ref('overview'), report = ref(null), loading = ref(false), error = ref('')
const linkFilter = ref('all'), relFilter = ref('all'), protocolFilter = ref('all'), statusFilter = ref('all'), imageFilter = ref('all'), query = ref(''), visible = ref(100)
const checked = ref({}), checking = ref(false), checkProgress = ref(0)
let cancelled = false, alive = true
const tabs = [['overview','Обзор'],['headings','Заголовки'],['links','Ссылки'],['images','Изображения'],['markup','Разметка'],['index','Индексация'],['page','Страница'],['tools','Инструменты']]
const scan = async () => {
    loading.value = true; error.value = ''
    try { const data = await sendSeoToTab(props.tab?.id); if (alive) { report.value = data; checked.value = {}; visible.value = 100 } }
    catch (e) { if (alive) error.value = e.message }
    finally { if (alive) loading.value = false }
}
onMounted(scan)
onUnmounted(() => { alive = false; cancelled = true })
const links = computed(() => (report.value?.linkRows || []).filter(item => {
    const info = checked.value[item.url]
    return (linkFilter.value === 'all' || (linkFilter.value === 'external' ? item.external : !item.external)) &&
        (relFilter.value === 'all' || (relFilter.value === 'follow' ? !item.nofollow : item.rel.split(/\s+/).includes(relFilter.value))) &&
        (protocolFilter.value === 'all' || item.protocol === protocolFilter.value) &&
        (statusFilter.value === 'all' || (statusFilter.value === 'broken' ? info && !info.ok : statusFilter.value === 'redirect' ? info?.redirected : !info)) &&
        `${item.text} ${item.url}`.toLowerCase().includes(query.value.toLowerCase())
}))
const images = computed(() => (report.value?.imageRows || []).filter(item => imageFilter.value === 'all' || (imageFilter.value === 'missing' ? item.alt === null : imageFilter.value === 'empty' ? item.alt === '' : Boolean(item.alt))))
const robotsRules = computed(() => report.value ? evaluateRobots(report.value.robotsFile.content, report.value.url) : null)
const checkLinks = async () => {
    checking.value = true; cancelled = false; error.value = ''; checkProgress.value = 0
    const urls = [...new Set(links.value.filter(item => /^https?:/.test(item.url)).map(item => item.url))]
    try {
        for (let i = 0; i < urls.length && !cancelled; i += 5) {
            const batch = await Promise.all(urls.slice(i, i + 5).map(async url => {
                let info = await fetchSeo(url, 'HEAD'); if (!info.ok && [0, 405, 501].includes(info.status)) info = await fetchSeo(url)
                return [url, { ...info, redirected: Boolean(info.url && info.url !== url) }]
            }))
            if (cancelled || !alive) break
            checked.value = { ...checked.value, ...Object.fromEntries(batch) }; checkProgress.value += batch.length
        }
    } catch (e) { if (alive) error.value = e.message }
    finally { if (alive) checking.value = false }
}
const toggle = async (action) => {
    try { report.value.actions = await sendSeoToTab(props.tab.id, 'seo:action', { action, enabled: !report.value.actions[action] }) }
    catch (e) { error.value = e.message }
}
const copyLinks = async () => { try { await navigator.clipboard.writeText(links.value.map(item => item.url).join('\n')) } catch (e) { error.value = e.message } }
const exportLinks = () => {
    const cell = value => `"${String(value ?? '').replaceAll('"', '""')}"`
    downloadText('\uFEFF' + [['URL','Анкор','Rel','HTTP'], ...links.value.map(item => [item.url,item.text,item.rel,checked.value[item.url]?.status])].map(row => row.map(cell).join(';')).join('\r\n'), 'links.csv', 'text/csv;charset=utf-8')
}
const overview = computed(() => report.value ? [
    ['URL',report.value.url], ['HTTP',report.value.response.status || 'Не получен'], ['Title',report.value.title || 'Отсутствует'], ['Длина Title',report.value.titleLength],
    ['Description',report.value.description || 'Отсутствует'], ['Длина Description',report.value.descriptionLength], ['Keywords',report.value.keywords || 'Отсутствует'],
    ['Язык',report.value.lang || 'Не указан'], ['CMS',report.value.generator || 'Не определена'], ['Canonical',report.value.canonical || 'Не указан'], ['Viewport',report.value.viewport ? 'Есть' : 'Нет'],
    ['Редирект',report.value.redirected ? report.value.finalUrl : 'Нет'], ['TTFB повторного запроса',report.value.response.ttfb == null ? 'Не измерен' : report.value.response.ttfb + ' мс']
] : [])
const tools = computed(() => {
    if (!report.value) return []
    const url = encodeURIComponent(report.value.url), host = encodeURIComponent(new URL(report.value.url).hostname), title = encodeURIComponent('"' + report.value.title + '"')
    return [
        ['PageSpeed Insights',`https://pagespeed.web.dev/analysis?url=${url}`], ['Валидатор HTML',`https://validator.w3.org/nu/?doc=${url}`],
        ['Валидатор CSS',`https://jigsaw.w3.org/css-validator/validator?uri=${url}`], ['Schema.org',`https://validator.schema.org/#url=${url}`],
        ['Google Rich Results',`https://search.google.com/test/rich-results?url=${url}`], ['WHOIS',`https://www.whois.com/whois/${host}`],
        ['SSL',`https://www.ssllabs.com/ssltest/analyze.html?d=${host}`], ['Webarchive',`https://web.archive.org/web/*/${report.value.url}`],
        ['Индексация в Google',`https://www.google.com/search?q=${encodeURIComponent('site:' + report.value.url)}`], ['Индексация в Яндексе',`https://yandex.ru/search/?text=${encodeURIComponent('url:' + report.value.url)}`],
        ['Дубли Title в Google',`https://www.google.com/search?q=${title}`], ['Дубли Title в Яндексе',`https://yandex.ru/search/?text=${title}`],
        ['Яндекс Вебмастер', 'https://webmaster.yandex.ru/sites/'], ['Орфография',`https://text.ru/spelling`], ['Проверка сайта по site:',`https://www.google.com/search?q=${encodeURIComponent('site:' + new URL(report.value.url).hostname)}`]
    ]
})
</script>
<template>
    <div class="grid gap-3 text-slate-200">
        <div class="flex flex-wrap items-center justify-between gap-2">
            <h1 class="text-lg font-semibold">SEO</h1>
            <div class="flex gap-2"><Button size="sm" variant="secondary" :disabled="loading || checking" @click="scan">{{ loading ? 'Сканируем…' : 'Обновить' }}</Button><Button size="sm" variant="secondary" :disabled="!tab?.id" @click="openSeoApp(tab.id)">Аудит ↗</Button></div>
        </div>
        <div class="flex flex-wrap gap-1" role="tablist" aria-label="Разделы SEO">
            <button v-for="item in tabs" :key="item[0]" role="tab" :aria-selected="section === item[0]" @click="section = item[0]; visible = 100" class="cursor-pointer rounded-md px-2 py-1.5 text-xs hover:bg-white/10" :class="section === item[0] ? 'bg-sky-400/15 text-sky-300' : 'text-slate-400'">{{ item[1] }}</button>
        </div>
        <Message v-if="error" type="error">{{ error }}</Message>
        <p v-if="loading" role="status" class="text-xs text-slate-400">Получаем данные страницы…</p>
        <template v-if="report">
            <template v-if="section === 'overview'">
                <Card title="Метаданные страницы"><dl class="grid gap-3 text-xs"><div v-for="[label,value] in overview" :key="label" class="grid gap-1"><dt class="text-slate-500">{{ label }}</dt><dd class="break-all text-slate-200">{{ value }}</dd></div></dl></Card>
                <Message v-if="report.titles.length !== 1 || report.canonicals.length > 1 || report.metaTags.some(item => !item.inHead)" type="error">Проверьте количество Title/Canonical и расположение метатегов: есть дубли или теги вне head.</Message>
                <details class="rounded-lg border border-white/10 p-3 text-xs"><summary class="cursor-pointer">Все метатеги ({{ report.metaTags.length }})</summary><div v-for="(item,index) in report.metaTags" :key="index" class="mt-2 break-all"><b>{{ item.name }}</b>: {{ item.content || '(пусто)' }} <span v-if="!item.inHead" class="text-amber-300">вне head</span></div></details>
            </template>
            <template v-if="section === 'headings'">
                <Button size="sm" variant="secondary" @click="toggle('headings')">{{ report.actions.headings ? 'Убрать подсветку' : 'Подсветить H1–H6' }}</Button>
                <p class="text-xs text-slate-400">H1: {{ report.h1Count }} · Дубли H1: {{ report.duplicateH1.length }}</p>
                <div v-for="(item,index) in report.headingRows" :key="index" class="rounded-lg border border-white/10 bg-slate-900/40 p-3 text-xs" :style="{ marginLeft: (item.level - 1) * 6 + 'px' }"><b class="mr-2 text-sky-300">H{{ item.level }}</b>{{ item.text || '(пустой)' }}</div>
            </template>
            <template v-if="section === 'links'">
                <div class="grid grid-cols-2 gap-2 text-xs">
                    <select v-model="linkFilter" aria-label="Тип ссылок" class="rounded bg-slate-800 p-2"><option value="all">Все ссылки</option><option value="internal">Внутренние</option><option value="external">Внешние</option></select>
                    <select v-model="relFilter" aria-label="Rel ссылок" class="rounded bg-slate-800 p-2"><option value="all">Все rel</option><option value="follow">Follow</option><option>nofollow</option><option>ugc</option><option>sponsored</option></select>
                    <select v-model="protocolFilter" aria-label="Протокол ссылок" class="rounded bg-slate-800 p-2"><option value="all">Все протоколы</option><option value="https:">HTTPS</option><option value="http:">HTTP</option><option value="mailto:">Email</option><option value="tel:">Телефон</option></select>
                    <select v-model="statusFilter" aria-label="Статус ссылок" class="rounded bg-slate-800 p-2"><option value="all">Все статусы</option><option value="broken">Ошибки</option><option value="redirect">Редиректы</option><option value="unchecked">Не проверены</option></select>
                </div>
                <input v-model="query" placeholder="Поиск по URL и анкору" class="rounded border border-white/10 bg-slate-900 p-2 text-xs" />
                <div class="flex flex-wrap gap-2"><Button size="sm" variant="secondary" :disabled="checking" @click="checkLinks">Проверить ссылки</Button><Button v-if="checking" size="sm" variant="ghost" @click="cancelled = true">Остановить</Button><Button size="sm" variant="ghost" @click="exportLinks">CSV</Button><Button size="sm" variant="ghost" @click="copyLinks">Копировать URL</Button></div>
                <p class="text-xs text-slate-400">Ссылок: {{ links.length }} · Проверено: {{ checkProgress }}. Проверка выполняется без cookies.</p>
                <article v-for="item in links.slice(0, visible)" :key="item.id" class="grid gap-1 rounded-lg border border-white/10 bg-slate-900/40 p-3 text-xs">
                    <a :href="/^https?:/.test(item.url) ? item.url : undefined" target="_blank" rel="noreferrer" class="break-all text-sky-300">{{ item.url }}</a>
                    <span>{{ item.text || 'Без анкора' }}</span><span class="text-slate-500">{{ item.external ? 'Внешняя' : 'Внутренняя' }} · {{ item.rel || 'follow' }} <b v-if="checked[item.url]" :class="checked[item.url].ok ? 'text-emerald-300' : 'text-amber-300'">· HTTP {{ checked[item.url].status || 'не получен' }}{{ checked[item.url].redirected ? ' → ' + checked[item.url].url : '' }}</b></span>
                </article>
                <Button v-if="links.length > visible" size="sm" variant="ghost" @click="visible += 100">Показать ещё</Button>
            </template>
            <template v-if="section === 'images'">
                <div class="flex gap-2"><select v-model="imageFilter" aria-label="Alt изображений" class="min-w-0 flex-1 rounded bg-slate-800 p-2 text-xs"><option value="all">Все изображения</option><option value="missing">Без атрибута alt</option><option value="empty">Пустой alt</option><option value="filled">Заполненный alt</option></select><Button size="sm" variant="secondary" @click="toggle('alt')">{{ report.actions.alt ? 'Убрать alt' : 'Показать alt' }}</Button></div>
                <p class="text-xs text-slate-400">Всего: {{ report.images.total }} · Без alt: {{ report.images.withoutAlt }} · Пустой alt: {{ report.images.emptyAlt }}</p>
                <article v-for="item in images.slice(0,visible)" :key="item.id" class="grid gap-1 rounded-lg border border-white/10 bg-slate-900/40 p-3 text-xs"><a :href="/^https?:/.test(item.src) ? item.src : undefined" target="_blank" rel="noreferrer" class="break-all text-sky-300">{{ item.src || 'Источник отсутствует' }}</a><span>Alt: {{ item.alt === null ? 'Отсутствует' : item.alt || '(пустой)' }}</span><span>Title: {{ item.title || 'Нет' }} · {{ item.width }} × {{ item.height }} · {{ item.loading || 'eager' }}</span></article>
                <Button v-if="images.length > visible" size="sm" variant="ghost" @click="visible += 100">Показать ещё</Button>
            </template>
            <template v-if="section === 'markup'">
                <Card title="Open Graph"><div v-for="item in report.metaTags.filter(item => /^og:/i.test(item.name))" :key="item.name" class="break-all text-xs"><b>{{ item.name }}</b>: {{ item.content }}</div><p v-if="!report.metaTags.some(item => /^og:/i.test(item.name))" class="text-xs text-slate-400">Не найден</p></Card>
                <Card title="JSON-LD"><div v-for="(item,index) in report.jsonLd" :key="index" class="mb-2"><p class="text-xs" :class="item.valid ? 'text-emerald-300' : 'text-amber-300'">{{ item.valid ? 'Корректный JSON' : item.error }}</p><pre class="max-h-72 overflow-auto whitespace-pre-wrap break-all text-[11px]">{{ item.valid ? JSON.stringify(item.value,null,2) : item.raw }}</pre></div><p v-if="!report.jsonLd.length" class="text-xs text-slate-400">Не найден</p></Card>
                <Card title="Microdata / RDFa"><pre class="max-h-72 overflow-auto whitespace-pre-wrap break-all text-[11px]">{{ JSON.stringify({ microdata: report.microdata, rdfa: report.rdfa },null,2) }}</pre></Card>
                <div class="flex flex-wrap gap-2"><a :href="tools.find(item => item[0] === 'Schema.org')?.[1]" target="_blank" rel="noreferrer" class="text-xs text-sky-300">Валидатор Schema.org ↗</a><a :href="tools.find(item => item[0] === 'Google Rich Results')?.[1]" target="_blank" rel="noreferrer" class="text-xs text-sky-300">Google Rich Results ↗</a></div>
            </template>
            <template v-if="section === 'index'">
                <Card title="Индексация"><div class="grid gap-2 text-xs"><p>Meta robots: {{ report.robots || 'Не задан' }}</p><p>X-Robots-Tag: {{ report.xRobots || 'Не задан' }}</p><p :class="report.robotsAllowed && report.xRobotsAllowed ? 'text-emerald-300' : 'text-amber-300'">{{ report.robotsAllowed && report.xRobotsAllowed ? 'Нет запрета noindex в метатеге/заголовке' : 'Есть запрет noindex' }}</p><p>robots.txt: {{ report.robotsFile.exists ? 'HTTP ' + report.robotsFile.status : 'Недоступен' }} · {{ robotsRules.allowed ? 'Путь разрешён для *' : 'Путь запрещён для *' }}</p><p class="text-slate-500">Отсутствие запрета не гарантирует индексацию. Правила конкретного робота могут отличаться.</p></div></Card>
                <details class="rounded-lg border border-white/10 p-3 text-xs"><summary class="cursor-pointer">robots.txt</summary><pre class="mt-2 overflow-auto whitespace-pre-wrap">{{ report.robotsFile.content || 'Пустой или не получен' }}</pre></details>
                <Card title="Canonical / hreflang"><p v-for="(item,index) in report.canonicals" :key="index" class="break-all text-xs">{{ item.href || '(пустой)' }} {{ item.inHead ? '' : 'вне head' }}</p><p v-for="(item,index) in report.hreflang" :key="index" class="break-all text-xs">{{ item.hreflang }}: {{ item.href }}</p></Card>
                <Button variant="secondary" size="sm" @click="openSeoApp(tab.id,'sitemap')">Открыть единый sitemap ↗</Button>
            </template>
            <template v-if="section === 'page'">
                <p class="text-xs text-slate-400">Изменения действуют только на этой странице до выключения или её закрытия/перезагрузки.</p>
                <Button v-for="[action,label] in [['external','Внешние ссылки'],['noindex','Noindex / nofollow'],['headings','Заголовки H1–H6'],['alt','Alt изображений'],['css','Отключить CSS']]" :key="action" size="sm" variant="secondary" @click="toggle(action)">{{ report.actions[action] ? '✓ ' : '' }}{{ label }}</Button>
                <Card title="Статистика текста"><p class="text-xs">Слов: {{ report.statistics.words }} · Символов: {{ report.statistics.characters }} · Без пробелов: {{ report.statistics.withoutSpaces }}</p><p class="text-xs">Выделенный текст: {{ report.statistics.selection.words }} слов, {{ report.statistics.selection.characters }} символов</p>
                    <details v-for="[key,label] in [['top','Частые слова'],['bigrams','Биграммы'],['withoutAnchors','Без анкоров'],['anchors','Анкоры'],['imageText','Alt и title изображений']]" :key="key" class="mt-3 text-xs"><summary class="cursor-pointer text-sky-300">{{ label }}</summary><p v-for="row in (Array.isArray(report.statistics[key]) ? report.statistics[key] : report.statistics[key].top)" :key="row.word">{{ row.word }} — {{ row.count }} ({{ row.density }}%)</p></details>
                </Card>
            </template>
            <div v-if="section === 'tools'" class="grid gap-2"><a v-for="[label,url] in tools" :key="label" :href="url" target="_blank" rel="noreferrer" class="rounded-lg border border-white/10 bg-slate-900/40 p-3 text-xs text-sky-300 hover:bg-white/5">{{ label }} ↗</a></div>
        </template>
    </div>
</template>

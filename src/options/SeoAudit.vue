<script setup>
import { computed, onUnmounted, ref, shallowRef } from 'vue'
import { extensionApi } from '../platform/extensionApi.js'
import { sendSeoToTab, fetchSeo } from '../utils/seoClient.js'
import { createAuditControl, runSeoAuditRequests } from '../utils/seoAuditRunner.js'
import { filterAuditPages, normalizeAuditPageLimit, summarizeAuditPages, AUDIT_PAGE_LIMIT, DEFAULT_AUDIT_PAGE_LIMIT } from '../utils/seoAuditPages.js'
import { AUDIT_DISCOVERY_LIMIT } from '../utils/seoAuditDiscovery.js'
import { buildAuditChecks, summarizeAuditChecks } from '../utils/seoAuditChecks.js'
import { evaluateRobotsFile } from '../utils/seoRules.js'
import { withoutFragment } from '../utils/linkCheckStatus.js'
import Button from '../popup/components/ui/Button.vue'
import Card from '../popup/components/ui/Card.vue'
import Notification from '../popup/components/ui/Notification.vue'
import SitemapDuplicates from './SitemapDuplicates.vue'

const props = defineProps({ tab: Object })
const state = ref('idle'), message = ref(''), notice = ref('')
const progress = ref({ current: 0, total: 0, started: 0 }), report = shallowRef(null), audit = shallowRef(null)
const pageLimit = ref(DEFAULT_AUDIT_PAGE_LIMIT), httpFilter = ref('all')
const httpFilters = [{ value: 'all', label: 'Все' }, { value: '4xx', label: 'Ошибки 4xx' }, { value: '5xx', label: 'Ошибки 5xx' }]
const filteredPages = computed(() => filterAuditPages(audit.value?.results || [], httpFilter.value))
const busy = computed(() => ['scanning', 'checking', 'paused', 'stopping'].includes(state.value))
const minimumLimit = computed(() => busy.value ? Math.max(progress.value.started || 0, 1) : 1)
const normalizePageLimit = () => {
    pageLimit.value = Math.max(minimumLimit.value, normalizeAuditPageLimit(pageLimit.value))
}
const checks = computed(() => report.value && audit.value ? buildAuditChecks(report.value, audit.value) : [])
const summary = computed(() => summarizeAuditChecks(checks.value))
const pages = computed(() => summarizeAuditPages(audit.value?.results || []))
const robots = computed(() => report.value && audit.value ? ['googlebot', 'yandex'].map(agent => ({ agent, ...evaluateRobotsFile(audit.value.robotsFile, report.value.url, agent) })) : [])
const labels = { pass: 'Подтверждено', fail: 'Проверки с проблемами', warning: 'Рекомендации', unknown: 'Неизвестно', na: 'Не применимо' }
const colors = { pass: 'text-ui-success', fail: 'text-ui-danger', warning: 'text-ui-warning', unknown: 'text-ui-muted', na: 'text-ui-muted' }
const symbols = { pass: '✓', fail: '✕', warning: '!', unknown: '?', na: '—' }
const sitemapLabels = { valid: 'XML прочитан', missing: 'Не найден', invalid: 'Ошибка обнаруженной карты', unknown: 'Не удалось подтвердить' }
let alive = true, revision = 0, controller, control
const stopAudit = () => { controller?.abort(); state.value = 'stopping' }
const togglePause = () => {
    if (state.value === 'paused') { normalizePageLimit(); control.resume(); state.value = 'checking' }
    else if (state.value === 'checking') { control.pause(); state.value = 'paused' }
}
onUnmounted(() => { alive = false; revision++; controller?.abort() })
const runAudit = async () => {
    if (busy.value) return
    const current = ++revision
    controller = new AbortController()
    const signal = controller.signal
    control = createAuditControl(signal)
    normalizePageLimit()
    state.value = 'scanning'; message.value = ''; notice.value = ''; audit.value = null; report.value = null; httpFilter.value = 'all'
    progress.value = { current: 0, total: 0, started: 0 }
    try {
        const tab = props.tab?.id ? await extensionApi.tabs.get(props.tab.id) : (await extensionApi.tabs.query({ active: true, lastFocusedWindow: true }))[0]
        if (!tab?.id || !/^https?:\/\//.test(tab.url || '')) throw new Error('Откройте проверяемый сайт')
        const data = await sendSeoToTab(tab.id, 'seo:dom', { internalLinkLimit: AUDIT_DISCOVERY_LIMIT - 1 })
        if (!alive || current !== revision) return
        report.value = data
        if (!signal.aborted) state.value = 'checking'
        const result = await runSeoAuditRequests(data, fetchSeo, {
            signal, getPageLimit: () => pageLimit.value, waitForResume: control.waitForResume,
            onProgress: value => { if (alive && current === revision) progress.value = value },
            onUpdate: value => { if (alive && current === revision) audit.value = value }
        })
        if (!alive || current !== revision) return
        audit.value = result
        if (result.partial) { notice.value = 'Проверка остановлена. Показаны только полученные результаты.'; state.value = 'partial'; return }
        try {
            const context = await sendSeoToTab(tab.id, 'seo:context')
            if (!alive || current !== revision) return
            if (context.documentId !== data.documentId || withoutFragment(context.url) !== withoutFragment(data.url)) {
                notice.value = 'Исходная страница изменилась во время проверки. Результат относится к прежнему снимку DOM; запустите аудит заново.'
                state.value = 'stale'; return
            }
        } catch {
            if (!alive || current !== revision) return
            notice.value = 'Не удалось подтвердить, что исходная страница не изменилась. Результат относится к снимку в начале проверки.'
            state.value = 'stale'; return
        }
        state.value = 'done'
    } catch (error) {
        if (!alive || current !== revision) return
        if (signal.aborted) { state.value = 'idle'; return }
        message.value = error.message; state.value = 'error'
    }
}
</script>
<template>
    <section class="flex min-w-0 w-full flex-col gap-4 text-ui-text">
        <header class="flex flex-wrap items-center justify-between gap-3">
            <h1 class="ui-title">SEO-аудит</h1>
            <Button variant="primary" size="md" :disabled="busy" @click="runAudit">{{ state === 'scanning' ? 'Снимок страницы…' : state === 'checking' ? 'Проверяем…' : state === 'paused' ? 'На паузе' : state === 'stopping' ? 'Останавливаем…' : 'Запустить аудит' }}</Button>
        </header>
        <div class="flex flex-wrap items-center gap-3">
            <label class="flex items-center gap-2 text-xs">Адресов для проверки<input v-model.number="pageLimit" aria-label="Адресов для проверки" type="number" :min="minimumLimit" :max="AUDIT_PAGE_LIMIT" step="1" class="ui-field w-24" :disabled="busy && (state !== 'paused' || !audit?.pagesPending)" @change="normalizePageLimit" /></label>
            <Button v-if="state === 'checking' || state === 'paused'" variant="secondary" size="sm" @click="togglePause">{{ state === 'paused' ? 'Продолжить' : 'Пауза' }}</Button>
            <Button v-if="busy" variant="secondary" size="sm" :disabled="state === 'stopping'" @click="stopAudit">Остановить аудит</Button>
        </div>
        <p class="text-xs text-ui-muted">До {{ AUDIT_PAGE_LIMIT.toLocaleString('ru-RU') }} URL. Источники: открытая страница, ссылки из проверенных HTML и sitemap.</p>
        <Notification v-if="message" :text="message" />
        <div v-if="busy && progress.total" class="ui-panel text-xs" role="status">
            HTTP: {{ progress.current }} из {{ progress.total }}<span v-if="audit?.sitemap.pending"> · sitemap загружается</span>
            <p v-if="state === 'paused'" class="mt-1 text-ui-warning">На паузе. Уже отправленные запросы завершаются.</p>
            <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-ui-raised"><div class="h-full bg-ui-primary transition-all" :style="{width:`${Math.round(progress.current / progress.total * 100)}%`}"></div></div>
        </div>
        <template v-if="audit && report">
            <p v-if="notice" role="status" class="ui-panel text-xs text-ui-warning">{{ notice }}</p>
            <Card title="Результаты проверки">
                <dl aria-label="Итоги аудита" class="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
                    <div v-for="(label,status) in labels" :key="status"><dt class="text-ui-muted">{{ label }}</dt><dd :class="colors[status]" class="mt-1 text-xl font-semibold tabular-nums">{{ summary[status] }}</dd></div>
                </dl>
                <a :href="report.url" :title="report.url" target="_blank" rel="noreferrer" class="mt-3 block truncate text-xs text-ui-accent">{{ report.url }}</a>
                <p class="mt-1 text-xs text-ui-muted">DOM: {{ new Date(report.scannedAt).toLocaleString('ru-RU') }}. HTTP: повторные GET-запросы без cookies.</p>
                <p class="mt-2 text-sm font-semibold">Найдено уникальных URL: {{ audit.sample.total }}{{ audit.sample.limited ? '+' : '' }}</p>
                <p class="mt-1 text-xs text-ui-muted">Открытая страница и ссылки: {{ audit.sample.linked }} · В sitemap: {{ audit.sample.mapped }} · Не встречены в обработанных sitemap: {{ audit.sample.outsideSitemap }}.</p>
                <p class="mt-1 text-xs text-ui-muted">HTTP-проверено: {{ audit.results.length }} из {{ audit.sample.total }}; лимит — {{ audit.sample.limit }}. Полных HTML по уникальным конечным URL: {{ pages.htmlCount }}.</p>
                <p class="mt-1 text-xs text-ui-muted">Счётчик отражает обнаруженные адреса в пределах сайта, а не полный размер сайта. {{ busy ? 'Поиск продолжается.' : audit.sample.limited ? 'Достигнут лимит сбора адресов.' : audit.results.length < audit.sample.total ? 'Часть найденных URL не проверена; ссылки с них не собраны.' : 'Обработаны доступные источники.' }}</p>
            </Card>
            <Card title="Проверки">
                <ul class="grid min-w-0 gap-1.5">
                    <li v-for="item in checks" :key="item.id" :data-check="item.id" :data-status="item.status" class="grid min-w-0 gap-1 rounded-control border border-ui-border bg-ui-field/40 px-3 py-2 text-xs sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] sm:gap-3">
                        <span class="flex min-w-0 items-start gap-2"><span :class="colors[item.status]" :title="labels[item.status]" class="shrink-0" :aria-label="labels[item.status]">{{ symbols[item.status] }}</span><span class="min-w-0 wrap-anywhere">{{ item.label }}</span></span>
                        <span v-if="item.hint" :title="item.hint" class="min-w-0 truncate text-[11px] text-ui-muted sm:text-right">{{ item.hint }}</span>
                    </li>
                </ul>
            </Card>
            <Card v-if="audit.results.length" title="HTTP-проверка выборки">
                <p class="mb-2 text-xs text-ui-muted">4xx: {{ pages.clientErrors }} (404/410: {{ pages.broken }}) · 5xx: {{ pages.serverErrors }} · Неизвестно / ограничения: {{ pages.uncertain }}</p>
                <fieldset class="mb-3 flex flex-wrap items-center gap-3 text-xs">
                    <legend class="mb-1 text-ui-muted">Показать HTTP-результаты</legend>
                    <label v-for="filter in httpFilters" :key="filter.value" :for="`audit-http-${filter.value}`" class="flex cursor-pointer items-center gap-1.5">
                        <input :id="`audit-http-${filter.value}`" v-model="httpFilter" type="radio" name="audit-http-filter" :value="filter.value" class="accent-ui-primary" />{{ filter.label }}
                    </label>
                </fieldset>
                <p class="mb-2 text-xs text-ui-muted" role="status">Показано: {{ filteredPages.length }} из {{ audit.results.length }}</p>
                <p v-if="!filteredPages.length" class="text-xs text-ui-muted">В проверенной выборке нет ошибок {{ httpFilter }}.</p>
                <ul v-else class="grid max-h-80 min-w-0 gap-2 overflow-y-auto pr-1 text-xs">
                    <li v-for="link in filteredPages" :key="link.url" class="grid min-w-0 gap-1 rounded-control bg-ui-field/40 px-2 py-1.5">
                        <div class="flex min-w-0 justify-between gap-3"><a :href="link.url" :title="link.url" target="_blank" rel="noreferrer" class="min-w-0 truncate text-ui-accent">{{ link.url }}</a><span class="shrink-0" :class="['broken','server'].includes(link.outcome) ? 'text-ui-danger' : link.outcome === 'ok' ? 'text-ui-success' : 'text-ui-warning'">{{ link.label }}</span></div>
                        <a v-if="link.redirected" :href="link.finalUrl" :title="link.finalUrl" target="_blank" rel="noreferrer" class="truncate text-ui-muted">→ {{ link.finalUrl }}</a>
                        <span v-if="link.metaReason" class="text-[11px] text-ui-muted">Метаданные: {{ link.metaReason }}</span>
                        <span v-if="link.ttfb !== null" class="text-[11px] text-ui-muted">До заголовков ответа: {{ link.ttfb }} мс</span>
                    </li>
                </ul>
            </Card>
            <Card v-for="[title,groups] in [['Совпадения Title в HTML-ответах',pages.duplicateTitles],['Совпадения Description в HTML-ответах',pages.duplicateDescriptions]].filter(([,groups]) => groups.length)" :key="title" :title="title">
                <details v-for="group in groups" :key="group.value" class="mt-2 text-xs"><summary class="cursor-pointer wrap-anywhere text-ui-warning">{{ group.value }} — {{ group.urls.length }} URL</summary><a v-for="url in group.urls" :key="url" :href="url" target="_blank" rel="noreferrer" class="mt-1 block break-all text-ui-accent">{{ url }}</a></details>
            </Card>
            <Card title="Sitemap">
                <p class="text-xs" :class="audit.sitemap.state === 'invalid' ? 'text-ui-danger' : audit.sitemap.state === 'valid' && audit.sitemap.complete ? 'text-ui-success' : 'text-ui-warning'">{{ audit.sitemap.pending ? 'Обработка sitemap…' : sitemapLabels[audit.sitemap.state] }}</p>
                <p class="mt-2 text-xs">Прочитано файлов: {{ audit.sitemap.files.length }} · URL: {{ audit.sitemap.pages.length }} · Повторов URL: {{ audit.sitemap.duplicates }}</p>
                <p class="mt-1 text-xs">Текущий URL: {{ audit.sitemap.containsCurrent ? 'найден' : audit.sitemap.state === 'missing' ? 'проверка неприменима' : audit.sitemap.complete ? 'не найден в обработанных картах' : 'результат неизвестен' }}</p>
                <p v-if="!audit.sitemap.pending && !audit.sitemap.complete && audit.sitemap.state !== 'missing'" class="mt-2 text-xs text-ui-warning">Обработка неполная{{ audit.sitemap.discoveryKnown === false ? ': robots.txt не прочитан, список карт может быть неполным' : '' }}.</p>
                <SitemapDuplicates :items="audit.sitemap.duplicateUrls" />
                <ul class="mt-2 grid gap-1 text-xs"><li v-for="file in audit.sitemap.files" :key="file.url" class="break-all"><a :href="file.url" target="_blank" rel="noreferrer" class="text-ui-accent">{{ file.url }}</a> · HTTP {{ file.status }} · {{ file.index ? 'индекс карт' : file.count + ' URL' }}</li><li v-for="error in audit.sitemap.errors" :key="error.url" class="break-all text-ui-warning">{{ error.url }} — {{ error.message }}</li></ul>
            </Card>
            <Card title="Robots.txt: правила для текущего пути">
                <section v-for="group in robots" :key="group.agent" class="mt-2 grid gap-1.5 text-xs">
                    <h3 class="font-semibold" :class="group.allowed === null ? 'text-ui-muted' : group.allowed ? 'text-ui-success' : 'text-ui-danger'">{{ group.agent }} — {{ group.allowed === null ? 'неизвестно' : group.allowed ? 'обход разрешён' : 'обход запрещён' }}</h3>
                    <p v-if="!group.rules.length" class="text-ui-muted">{{ group.allowed === null ? 'Правила не получены полностью' : 'Подходящих ограничений не найдено' }}</p>
                    <div v-for="(rule,index) in group.rules" :key="index" class="grid gap-1 rounded-control bg-ui-field/40 px-2 py-1.5"><span class="break-all">{{ rule.directive.toUpperCase() }}: {{ rule.value }}</span><span class="text-[11px] text-ui-muted">{{ index === 0 ? 'Определяет результат' : 'Перекрыто правилом выше' }}</span></div>
                </section>
            </Card>
        </template>
        <p v-else-if="!busy" class="text-xs text-ui-muted">Снимок DOM, GET-проверка выбранного количества URL и обработка обнаруженных sitemap.</p>
    </section>
</template>

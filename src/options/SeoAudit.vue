<script setup>
import { computed, onUnmounted, ref, shallowRef, watch } from 'vue'
import { extensionApi } from '../platform/extensionApi.js'
import { sendSeoToTab, withActiveTab, fetchSeo, downloadText } from '../utils/seoClient.js'
import { createAuditControl, runSeoAuditRequests } from '../utils/seoAuditRunner.js'
import { normalizeAuditPageLimit, AUDIT_PAGE_LIMIT, DEFAULT_AUDIT_PAGE_LIMIT } from '../utils/seoAuditPages.js'
import { AUDIT_MODES } from '../utils/seoAuditLinks.js'
import { buildAuditChecks } from '../utils/seoAuditChecks.js'
import { buildAuditIssues, isAuditProblem } from '../utils/seoAuditIssues.js'
import { buildAuditExport } from '../utils/seoAuditExport.js'
import { useSeoAuditView } from './useSeoAuditView.js'
import { withoutFragment } from '../utils/linkCheckStatus.js'
import Button from '../popup/components/ui/Button.vue'
import Select from '../popup/components/ui/Select.vue'
import Notification from '../popup/components/ui/Notification.vue'
import Tabs from '../popup/components/ui/Tabs.vue'
import SeoAuditSummary from './SeoAuditSummary.vue'
import SeoAuditIssueView from './SeoAuditIssueView.vue'
import SeoAuditLinks from './SeoAuditLinks.vue'
import SeoAuditFiles from './SeoAuditFiles.vue'
import SeoAuditPages from './SeoAuditPages.vue'
import SeoAuditExclusions from './SeoAuditExclusions.vue'

const props = defineProps({ tab: Object })
const state = ref('idle'), message = ref(''), notice = ref('')
const progress = ref({ current: 0, total: 0, started: 0, crawl: { started: 0 } }), report = shallowRef(null), audit = shallowRef(null)
const pageLimit = ref(DEFAULT_AUDIT_PAGE_LIMIT), crawlPageLimit = ref(DEFAULT_AUDIT_PAGE_LIMIT), mode = ref('pages')
const excludeNonIndexable = ref(true)
const selectedMode = computed(() => AUDIT_MODES.find(item => item.value === mode.value))
const busy = computed(() => ['scanning', 'checking', 'paused', 'stopping'].includes(state.value))
const minimumLimit = computed(() => busy.value ? Math.max(progress.value.started || 0, 1) : 1)
const minimumCrawlLimit = computed(() => busy.value ? Math.max(progress.value.crawl.started || 0, 1) : 1)
const normalizeLimits = () => {
    pageLimit.value = Math.max(minimumLimit.value, normalizeAuditPageLimit(pageLimit.value))
    crawlPageLimit.value = Math.max(minimumCrawlLimit.value, normalizeAuditPageLimit(crawlPageLimit.value))
}
const checks = computed(() => report.value && audit.value ? buildAuditChecks(report.value, audit.value) : [])
const issues = computed(() => report.value && audit.value ? buildAuditIssues(report.value, audit.value, checks.value) : [])
const { section, filter, focusId, openIssue, closeIssue, showStatus, resetView } = useSeoAuditView(props.tab)
const runId = ref(0)
const issueCount = computed(() => issues.value.filter(isAuditProblem).length)
const excludedCount = computed(() => audit.value?.exclusions?.items?.length || 0)
const sections = computed(() => {
    const items = [
        ['summary', 'Сводка'],
        ['issues', issueCount.value ? `Ошибки · ${issueCount.value}` : 'Ошибки'],
        ['links', `Ссылки · ${audit.value?.results.length || 0}`],
        ['pages', `Страницы · ${audit.value?.pageResults.length || 0}`],
        ['files', 'Файлы']
    ]
    if (excludedCount.value) items.push(['exclusions', `Исключения · ${excludedCount.value}`])
    return items
})
watch([sections, busy], ([value, running]) => {
    if (audit.value && !running && !value.some(([key]) => key === section.value)) section.value = 'summary'
})
let alive = true, revision = 0, controller, control
const stopAudit = () => { controller?.abort(); state.value = 'stopping' }
const togglePause = () => {
    if (state.value === 'paused') { normalizeLimits(); control.resume(); state.value = 'checking' }
    else if (state.value === 'checking') { control.pause(); state.value = 'paused' }
}
onUnmounted(() => { alive = false; revision++; controller?.abort() })
const runAudit = async () => {
    if (busy.value) return
    const current = ++revision
    controller = new AbortController()
    const signal = controller.signal
    control = createAuditControl(signal)
    normalizeLimits()
    const auditMode = mode.value
    if (report.value || audit.value) resetView()
    runId.value++
    state.value = 'scanning'; message.value = ''; notice.value = ''; audit.value = null; report.value = null
    progress.value = { current: 0, total: 0, started: 0, crawl: { started: 0 } }
    try {
        const tab = props.tab?.id ? await extensionApi.tabs.get(props.tab.id) : (await extensionApi.tabs.query({ active: true, lastFocusedWindow: true }))[0]
        if (!tab?.id || !/^https?:\/\//.test(tab.url || '')) throw new Error('Откройте проверяемый сайт')
        const data = await withActiveTab(tab.id, () => sendSeoToTab(tab.id, 'seo:dom', { includeAuditLinks: true }))
        if (!alive || current !== revision) return
        report.value = data
        if (!signal.aborted) state.value = 'checking'
        const result = await runSeoAuditRequests(data, fetchSeo, {
            signal, mode: auditMode, excludeNonIndexable: excludeNonIndexable.value,
            getPageLimit: () => pageLimit.value, getCrawlPageLimit: () => crawlPageLimit.value, waitForResume: control.waitForResume,
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
const exportReport = () => downloadText(JSON.stringify(buildAuditExport(report.value, audit.value, issues.value,
    { state: state.value, notice: notice.value }), null, 2), `seo-audit-${new Date().toISOString().slice(0, 10)}.json`, 'application/json;charset=utf-8')
</script>
<template>
    <section class="flex min-w-0 w-full flex-col gap-4 text-ui-text">
        <header class="flex flex-wrap items-center justify-between gap-3">
            <h1 class="ui-title">SEO-аудит сайта</h1>
            <div class="flex flex-wrap gap-2">
                <Button v-if="audit && report" variant="secondary" size="md" @click="exportReport">Скачать отчёт (JSON)</Button>
                <Button variant="primary" size="md" :disabled="busy" @click="runAudit">{{ state === 'scanning' ? 'Снимок страницы…' : state === 'checking' ? 'Проверяем…' : state === 'paused' ? 'На паузе' : state === 'stopping' ? 'Останавливаем…' : 'Запустить аудит' }}</Button>
            </div>
        </header>
        <div class="ui-panel grid gap-3">
            <label class="grid gap-1 text-xs text-ui-muted">Режим проверки<Select v-model="mode" aria-label="Режим проверки" :disabled="busy"><option v-for="item in AUDIT_MODES" :key="item.value" :value="item.value">{{ item.label }}</option></Select></label>
            <p class="text-xs text-ui-muted">{{ selectedMode.hint }}</p>
            <div>
                <label class="flex min-h-11 items-center gap-2 text-xs" :class="busy ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'">
                    <input v-model="excludeNonIndexable" type="checkbox" :disabled="busy" aria-describedby="audit-exclude-hint" class="size-4 shrink-0 accent-ui-primary" />Исключать неиндексируемые страницы
                </label>
                <p id="audit-exclude-hint" class="text-[11px] text-ui-muted">Учитывать robots.txt и noindex в meta / X-Robots-Tag для Googlebot и Яндекса. Noindex можно определить только после загрузки страницы; ссылки с неё дальше не проверяются.</p>
            </div>
            <div class="flex flex-wrap items-center gap-3">
                <label class="flex flex-wrap items-center gap-2 text-xs">{{ mode === 'external' ? 'Лимит внешних URL' : mode === 'pages' ? 'Лимит страниц' : 'Лимит внутренних URL' }}<input v-model.number="pageLimit" aria-label="Лимит HTTP-проверки" type="number" :min="minimumLimit" :max="AUDIT_PAGE_LIMIT" step="1" class="ui-field w-24" :disabled="busy && (state !== 'paused' || !audit?.pagesPending)" @change="normalizeLimits" /></label>
                <label v-if="mode === 'external'" class="flex flex-wrap items-center gap-2 text-xs">Лимит обхода страниц<input v-model.number="crawlPageLimit" aria-label="Лимит обхода страниц" type="number" :min="minimumCrawlLimit" :max="AUDIT_PAGE_LIMIT" step="1" class="ui-field w-24" :disabled="busy && (state !== 'paused' || !audit?.crawl.pending)" @change="normalizeLimits" /></label>
                <Button v-if="state === 'checking' || state === 'paused'" variant="secondary" size="sm" @click="togglePause">{{ state === 'paused' ? 'Продолжить' : 'Пауза' }}</Button>
                <Button v-if="busy" variant="secondary" size="sm" :disabled="state === 'stopping'" @click="stopAudit">Остановить аудит</Button>
            </div>
            <p class="text-[11px] text-ui-muted">Обход без авторизации: ссылки берём из гостевого HTML и sitemap, cookies браузера не отправляем. Каждый лимит — до {{ AUDIT_PAGE_LIMIT.toLocaleString('ru-RU') }} запросов; изменить его можно на паузе.</p>
        </div>
        <Notification v-if="message" :text="message" />
        <div v-if="busy && audit" class="ui-panel text-xs" role="status">
            HTTP{{ audit.mode === 'external' ? ' внешних URL' : '' }}: {{ progress.current }} из {{ progress.total }}<span v-if="audit.mode === 'external'"> · Обход страниц: {{ audit.crawl.current }} из {{ audit.crawl.total }}</span><span v-if="audit.sitemap.pending"> · sitemap загружается</span>
            <p v-if="state === 'paused'" class="mt-1 text-ui-warning">На паузе. Уже отправленные запросы завершаются.</p>
            <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-ui-raised"><div class="h-full bg-ui-primary transition-all" :style="{width:`${progress.total ? Math.round(progress.current / progress.total * 100) : 0}%`}"></div></div>
        </div>
        <template v-if="audit && report">
            <p v-if="notice" role="status" class="ui-panel text-xs text-ui-warning">{{ notice }}</p>
            <Tabs v-model="section" :items="sections" label="Разделы SEO-аудита" wrap />
            <KeepAlive :key="runId">
                <SeoAuditSummary v-if="section === 'summary'" :report="report" :audit="audit" :issues="issues" :busy="busy" @select-status="showStatus" />
                <SeoAuditIssueView v-else-if="section === 'issues'" v-model:filter="filter" :issues="issues" :audit="audit" :focus-id="focusId" :busy="busy" @select="openIssue" @back="closeIssue" />
                <SeoAuditLinks v-else-if="section === 'links'" :results="audit.results" :mode="audit.mode" :page-url="report.url" />
                <SeoAuditPages v-else-if="section === 'pages'" :results="audit.pageResults" :issues="issues" @select-issue="openIssue" />
                <SeoAuditFiles v-else-if="section === 'files'" :report="report" :audit="audit" />
                <SeoAuditExclusions v-else-if="section === 'exclusions'" :exclusions="audit.exclusions" />
            </KeepAlive>
        </template>
        <p v-else-if="!busy" class="text-xs text-ui-muted">Выберите режим проверки и запустите аудит. Результат покажет ошибки, рекомендации и страницы, на которых найдена каждая ссылка.</p>
    </section>
</template>

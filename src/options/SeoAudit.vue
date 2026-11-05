<script setup>
import { computed, onUnmounted, ref, shallowRef, watch } from 'vue'
import { extensionApi } from '../platform/extensionApi.js'
import { sendSeoToTab, withActiveTab, fetchSeo, downloadText } from '../utils/seoClient.js'
import { loadSeoHtml } from '../utils/seoHtml.js'
import { SeoTabUnavailableError } from '../utils/seoMessaging.js'
import { createAuditControl, runSeoAuditRequests } from '../utils/seoAuditRunner.js'
import { normalizeAuditPageLimit, DEFAULT_AUDIT_PAGE_LIMIT } from '../utils/seoAuditPages.js'
import { buildAuditChecks } from '../utils/seoAuditChecks.js'
import { buildAuditIssues, isAuditProblem } from '../utils/seoAuditIssues.js'
import { buildAuditExport } from '../utils/seoAuditExport.js'
import { useSeoAuditView } from './useSeoAuditView.js'
import { withoutFragment } from '../utils/linkCheckStatus.js'
import Button from '../popup/components/ui/Button.vue'
import EmptyState from '../popup/components/ui/EmptyState.vue'
import Notification from '../popup/components/ui/Notification.vue'
import Tabs from '../popup/components/ui/Tabs.vue'
import SeoAuditSummary from './SeoAuditSummary.vue'
import SeoAuditIssueView from './SeoAuditIssueView.vue'
import SeoAuditLinks from './SeoAuditLinks.vue'
import SeoAuditFiles from './SeoAuditFiles.vue'
import SeoAuditPages from './SeoAuditPages.vue'
import SeoAuditExclusions from './SeoAuditExclusions.vue'
import SeoAuditSettings from './SeoAuditSettings.vue'
import SeoAuditAvailability from './SeoAuditAvailability.vue'
import SeoAuditInfo from './SeoAuditInfo.vue'

const props = defineProps({ tab: Object, manualUrl: String, docked: Boolean })
const state = ref('idle'), message = ref(''), notice = ref('')
const progress = ref({ current: 0, total: 0, started: 0, crawl: { started: 0 } }), report = shallowRef(null), audit = shallowRef(null)
const pageLimit = ref(DEFAULT_AUDIT_PAGE_LIMIT), crawlPageLimit = ref(DEFAULT_AUDIT_PAGE_LIMIT), mode = ref('pages')
const excludeNonIndexable = ref(true), customExclusions = ref('')
const busy = computed(() => ['scanning', 'checking', 'paused', 'stopping'].includes(state.value))
const minimumLimit = computed(() => busy.value ? Math.max(progress.value.started || 0, 1) : 1)
const minimumCrawlLimit = computed(() => busy.value ? Math.max(progress.value.crawl.started || 0, 1) : 1)
const normalizeLimits = () => {
    pageLimit.value = Math.max(minimumLimit.value, normalizeAuditPageLimit(pageLimit.value))
    crawlPageLimit.value = Math.max(minimumCrawlLimit.value, normalizeAuditPageLimit(crawlPageLimit.value))
}
const checks = computed(() => report.value && audit.value && audit.value.mode !== 'external' ? buildAuditChecks(report.value, audit.value, { hideUnavailableMetrics: !props.docked }) : [])
const issues = computed(() => report.value && audit.value && audit.value.mode !== 'external' ? buildAuditIssues(report.value, audit.value, checks.value) : [])
const { section, filter, focusId, openIssue, closeIssue, showStatus, resetView } = useSeoAuditView(props.tab || { url: props.manualUrl })
const runId = ref(0)
const issueCount = computed(() => issues.value.filter(isAuditProblem).length)
const excludedCount = computed(() => audit.value?.exclusions?.items?.length || 0)
const sections = computed(() => {
    const items = audit.value?.mode === 'external' ? [['links', `Внешние ссылки · ${audit.value.results.length}`]] : [
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
    if (auditMode === 'external') section.value = 'links'
    runId.value++
    state.value = 'scanning'; message.value = ''; notice.value = ''; audit.value = null; report.value = null
    progress.value = { current: 0, total: 0, started: 0, crawl: { started: 0 } }
    try {
        const tab = props.manualUrl ? null : await extensionApi.tabs.get(props.tab.id)
        if (tab && !/^https?:\/\//.test(tab.url || '')) throw new Error('Откройте проверяемый сайт')
        const data = tab
            ? await withActiveTab(tab.id, () => sendSeoToTab(tab.id, 'seo:dom', { includeAuditLinks: true }))
            : await loadSeoHtml(props.manualUrl, { includeAuditLinks: true })
        if (!alive || current !== revision) return
        signal.throwIfAborted()
        report.value = data
        if (!signal.aborted) state.value = 'checking'
        const result = await runSeoAuditRequests(data, fetchSeo, {
            signal, mode: auditMode, excludeNonIndexable: excludeNonIndexable.value, customExclusions: customExclusions.value,
            getPageLimit: () => pageLimit.value, getCrawlPageLimit: () => crawlPageLimit.value, waitForResume: control.waitForResume,
            onProgress: value => { if (alive && current === revision) progress.value = value },
            onUpdate: value => { if (alive && current === revision) audit.value = value }
        })
        if (!alive || current !== revision) return
        audit.value = result
        if (result.partial) { notice.value = 'Проверка остановлена. Показаны только полученные результаты.'; state.value = 'partial'; return }
        if (!tab) { state.value = 'done'; return }
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
        message.value = error.message
        state.value = error instanceof SeoTabUnavailableError ? 'unavailable' : 'error'
    }
}
const exportReport = () => downloadText(JSON.stringify(buildAuditExport(report.value, audit.value, issues.value,
    { state: state.value, notice: notice.value }), null, 2), `seo-audit-${new Date().toISOString().slice(0, 10)}.json`, 'application/json;charset=utf-8')
</script>
<template>
    <section class="flex min-w-0 w-full flex-col gap-4 text-ui-text">
        <header class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-1"><h1 class="ui-title">SEO-аудит сайта</h1><SeoAuditInfo label="Как выполняется аудит" :text="manualUrl ? 'Аудит использует исходный HTML и sitemap сайта. Cookies не отправляются. Лимиты можно изменить на паузе; режим и правила — перед новым запуском.' : 'Ссылки собираются из гостевого HTML и sitemap исходного сайта. Cookies не отправляются. DOM и показатели скорости относятся к исходной странице. Лимиты можно изменить на паузе; режим и правила — перед новым запуском.'" /></div>
            <div class="flex flex-wrap gap-2">
                <Button v-if="audit && report" variant="secondary" size="md" @click="exportReport">Скачать отчёт (JSON)</Button>
                <Button v-if="state === 'checking' || state === 'paused'" variant="secondary" size="md" @click="togglePause">{{ state === 'paused' ? 'Продолжить' : 'Пауза' }}</Button>
                <Button v-if="busy" variant="secondary" size="md" :disabled="state === 'stopping'" @click="stopAudit">Остановить аудит</Button>
                <Button variant="primary" size="md" :disabled="busy" @click="runAudit">{{ state === 'scanning' ? 'Снимок страницы…' : state === 'checking' ? 'Проверяем…' : state === 'paused' ? 'На паузе' : state === 'stopping' ? 'Останавливаем…' : 'Запустить аудит' }}</Button>
            </div>
        </header>
        <SeoAuditSettings v-model:mode="mode" v-model:page-limit="pageLimit" v-model:crawl-page-limit="crawlPageLimit" v-model:exclude-non-indexable="excludeNonIndexable" v-model:custom-exclusions="customExclusions" :busy="busy" :state="state" :minimum-limit="minimumLimit" :minimum-crawl-limit="minimumCrawlLimit" :pages-pending="audit?.pagesPending" :crawl-pending="audit?.crawl.pending" @normalize="normalizeLimits" />
        <EmptyState v-if="state === 'unavailable'" title="Страница недоступна для анализа." :description="message" />
        <Notification v-else-if="state === 'error'" :text="message" />
        <div v-if="busy && audit" class="ui-panel text-xs" role="status">
            HTTP{{ audit.mode === 'external' ? ' внешних URL' : '' }}: {{ progress.current }} из {{ progress.total }}<span v-if="audit.mode === 'external'"> · Обход страниц: {{ audit.crawl.current }} из {{ audit.crawl.total }}</span><span v-if="audit.sitemap.pending"> · sitemap загружается</span>
            <p v-if="state === 'paused'" class="mt-1 text-ui-warning">На паузе. Уже отправленные запросы завершаются.</p>
            <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-ui-raised"><div class="h-full bg-ui-primary transition-all" :style="{width:`${progress.total ? Math.round(progress.current / progress.total * 100) : 0}%`}"></div></div>
        </div>
        <template v-if="audit && report">
            <p v-if="notice" role="status" class="ui-panel text-xs text-ui-warning">{{ notice }}</p>
            <Tabs v-if="sections.length > 1" v-model="section" :items="sections" label="Разделы SEO-аудита" wrap />
            <KeepAlive :key="runId">
                <SeoAuditSummary v-if="section === 'summary'" :report="report" :audit="audit" :issues="issues" :busy="busy" @select-status="showStatus" />
                <SeoAuditIssueView v-else-if="section === 'issues'" v-model:filter="filter" :issues="issues" :audit="audit" :focus-id="focusId" :busy="busy" @select="openIssue" @back="closeIssue" />
                <SeoAuditAvailability v-else-if="section === 'links' && audit.mode === 'external'" :results="audit.results" />
                <SeoAuditLinks v-else-if="section === 'links'" :results="audit.results" :mode="audit.mode" :page-url="report.url" />
                <SeoAuditPages v-else-if="section === 'pages'" :results="audit.pageResults" :issues="issues" @select-issue="openIssue" />
                <SeoAuditFiles v-else-if="section === 'files'" :report="report" :audit="audit" />
                <SeoAuditExclusions v-else-if="section === 'exclusions'" :exclusions="audit.exclusions" />
            </KeepAlive>
        </template>
    </section>
</template>

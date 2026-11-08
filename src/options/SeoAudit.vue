<script setup>
import { computed, onUnmounted, ref, shallowRef, watch } from 'vue'
import { extensionApi } from '../platform/extensionApi.js'
import { sendSeoToTab, withActiveTab, fetchSeo, downloadText } from '../utils/seoClient.js'
import { loadSeoHtml } from '../utils/seoHtml.js'
import { SeoTabUnavailableError } from '../utils/seoMessaging.js'
import { createAuditControl, runSeoAuditRequests } from '../utils/seoAuditRunner.js'
import { normalizeAuditPageLimit, DEFAULT_AUDIT_PAGE_LIMIT } from '../utils/seoAuditPages.js'
import { DEFAULT_AUDIT_EXCLUSIONS, parseAuditExclusionLists } from '../utils/seoAuditExclusionRules.js'
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
import SeoAuditProgress from './SeoAuditProgress.vue'
import SeoAuditAvailability from './SeoAuditAvailability.vue'
import SeoAuditInfo from './SeoAuditInfo.vue'

const props = defineProps({ tab: Object, manualUrl: String, docked: Boolean })
const state = ref('idle'), message = ref(''), notice = ref(''), settingsError = ref('')
const initialProgress = (url = '') => ({
    current: 0, total: 0, started: 0, crawl: { started: 0 }, activeRequests: url ? [{ id: 0, url, method: '' }] : []
})
const progress = shallowRef(initialProgress()), report = shallowRef(null), audit = shallowRef(null)
const pageLimit = ref(DEFAULT_AUDIT_PAGE_LIMIT), crawlPageLimit = ref(DEFAULT_AUDIT_PAGE_LIMIT), mode = ref('pages')
const excludeNonIndexable = ref(true), exclusionLists = ref({ ...DEFAULT_AUDIT_EXCLUSIONS })
const settingsOpen = ref(true), exclusionsOpen = ref(false), activeSettings = shallowRef(null)
const readScope = () => ({ mode: mode.value, excludeNonIndexable: excludeNonIndexable.value, ...exclusionLists.value })
const stopping = computed(() => state.value === 'stopping' || state.value === 'restarting')
const busy = computed(() => stopping.value || ['scanning', 'checking', 'paused'].includes(state.value))
const restartRequired = computed(() => {
    const active = activeSettings.value
    if (state.value !== 'paused' || !active) return false
    return Object.entries(readScope()).some(([key, value]) => active[key] !== value)
        || (audit.value?.pagesPending === false && normalizeAuditPageLimit(pageLimit.value) !== active.pageLimit)
        || (active.mode === 'external' && audit.value?.crawl.pending === false && normalizeAuditPageLimit(crawlPageLimit.value) !== active.crawlPageLimit)
})
const minimumLimit = computed(() => busy.value && !restartRequired.value ? Math.max(progress.value.started, 1) : 1)
const minimumCrawlLimit = computed(() => busy.value && !restartRequired.value ? Math.max(progress.value.crawl.started, 1) : 1)
const normalizeLimits = () => {
    pageLimit.value = normalizeAuditPageLimit(pageLimit.value, minimumLimit.value)
    crawlPageLimit.value = normalizeAuditPageLimit(crawlPageLimit.value, minimumCrawlLimit.value)
    return { pageLimit: pageLimit.value, crawlPageLimit: crawlPageLimit.value }
}
const closeSettings = () => { settingsOpen.value = false; exclusionsOpen.value = false }
watch(exclusionLists, () => { settingsError.value = '' })
const validateExclusions = () => {
    try { parseAuditExclusionLists(exclusionLists.value); return true }
    catch (error) {
        settingsError.value = error.message
        settingsOpen.value = true; exclusionsOpen.value = true
        return false
    }
}
const runButtonLabel = computed(() => ({
    scanning: 'Снимок страницы…', checking: 'Проверяем…', paused: 'На паузе', stopping: 'Останавливаем…', restarting: 'Перезапускаем…'
})[state.value] || 'Запустить аудит')
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
        ['files', audit.value?.mode === 'internal' ? 'Служебные файлы' : 'Файлы']
    ]
    if (excludedCount.value) items.push(['exclusions', `Исключения · ${excludedCount.value}`])
    return items
})
watch([sections, busy], ([value, running]) => {
    if (audit.value && !running && !value.some(([key]) => key === section.value)) section.value = 'summary'
})
let alive = true, revision = 0, controller, control, auditTask
const stopAudit = () => { state.value = 'stopping'; controller?.abort() }
const pauseAudit = () => { control.pause(); state.value = 'paused'; settingsOpen.value = true }
const resumeAudit = async () => {
    if (state.value !== 'paused') return
    if (!restartRequired.value) {
        activeSettings.value = { ...activeSettings.value, ...normalizeLimits() }
        closeSettings()
        control.resume(); state.value = 'checking'
        return
    }
    if (!validateExclusions()) return
    const settings = { ...readScope(), ...normalizeLimits() }, current = revision
    state.value = 'restarting'
    controller.abort()
    await auditTask
    if (alive && current === revision) auditTask = runAudit(settings)
}
onUnmounted(() => { alive = false; revision++; controller?.abort() })
const showPartial = () => {
    notice.value = 'Проверка остановлена. Показаны только полученные результаты.'
    state.value = 'partial'
}
const runAudit = async settings => {
    const current = ++revision
    controller = new AbortController()
    const signal = controller.signal
    control = createAuditControl(signal)
    activeSettings.value = settings
    closeSettings()
    if (report.value || audit.value) resetView()
    if (settings.mode === 'external') section.value = 'links'
    runId.value++
    state.value = 'scanning'; message.value = ''; notice.value = ''; audit.value = null; report.value = null
    progress.value = initialProgress(props.manualUrl || props.tab?.url)
    try {
        const tab = props.manualUrl ? null : await extensionApi.tabs.get(props.tab.id)
        if (tab && !/^https?:\/\//.test(tab.url || '')) throw new Error('Откройте проверяемый сайт')
        if (tab) progress.value = initialProgress(tab.url)
        const data = tab
            ? await withActiveTab(tab.id, () => sendSeoToTab(tab.id, 'seo:dom', { includeAuditLinks: true }))
            : await loadSeoHtml(props.manualUrl, { includeAuditLinks: true })
        if (!alive || current !== revision) return
        signal.throwIfAborted()
        report.value = data
        if (!signal.aborted) state.value = 'checking'
        const result = await runSeoAuditRequests(data, fetchSeo, {
            ...settings, signal, getPageLimit: () => activeSettings.value.pageLimit,
            getCrawlPageLimit: () => activeSettings.value.crawlPageLimit, waitForResume: control.waitForResume,
            onProgress: value => { if (alive && current === revision) progress.value = value },
            onUpdate: value => { if (alive && current === revision) audit.value = value }
        })
        if (!alive || current !== revision || state.value === 'restarting') return
        audit.value = result
        let staleNotice = ''
        if (tab && !result.partial) {
            try {
                const context = await sendSeoToTab(tab.id, 'seo:context')
                if (context.documentId !== data.documentId || withoutFragment(context.url) !== withoutFragment(data.url)) {
                    staleNotice = 'Исходная страница изменилась во время проверки. Результат относится к прежнему снимку DOM. Запустите аудит заново.'
                }
            } catch {
                staleNotice = 'Не удалось подтвердить, что исходная страница сохранилась. Результат относится к снимку в начале проверки.'
            }
        }
        if (state.value === 'paused') await control.waitForResume()
        if (!alive || current !== revision || state.value === 'restarting') return
        signal.throwIfAborted()
        if (result.partial) { showPartial(); return }
        notice.value = staleNotice
        state.value = staleNotice ? 'stale' : 'done'
    } catch (error) {
        if (!alive || current !== revision || state.value === 'restarting') return
        if (signal.aborted) {
            if (audit.value) showPartial()
            else state.value = 'idle'
            return
        }
        message.value = error.message
        state.value = error instanceof SeoTabUnavailableError ? 'unavailable' : 'error'
    } finally {
        if (alive && current === revision && state.value !== 'restarting') {
            activeSettings.value = null
            if (audit.value || signal.aborted) exclusionLists.value = { ...DEFAULT_AUDIT_EXCLUSIONS }
        }
    }
}
const startAudit = () => {
    if (!busy.value && validateExclusions()) auditTask = runAudit({ ...readScope(), ...normalizeLimits() })
}
const exportReport = () => downloadText(JSON.stringify(buildAuditExport(report.value, audit.value, issues.value,
    { state: state.value, notice: notice.value }), null, 2), `seo-audit-${new Date().toISOString().slice(0, 10)}.json`, 'application/json;charset=utf-8')
</script>
<template>
    <section class="flex min-w-0 w-full flex-col gap-4 text-ui-text">
        <header class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-1"><h1 class="ui-title">SEO-аудит сайта</h1><SeoAuditInfo label="Как выполняется аудит" :text="manualUrl ? 'Аудит использует исходный HTML и sitemap сайта. Cookies не отправляются.' : 'Ссылки собираются из гостевого HTML и sitemap исходного сайта. Cookies не отправляются. DOM и показатели скорости относятся к исходной странице.'" /></div>
            <div class="flex flex-wrap gap-2">
                <Button v-if="audit && report" variant="secondary" size="md" @click="exportReport">Скачать отчёт (JSON)</Button>
                <Button v-if="state === 'checking'" variant="secondary" size="md" @click="pauseAudit">Пауза</Button>
                <Button v-else-if="state === 'paused'" variant="secondary" size="md" @click="resumeAudit">{{ restartRequired ? 'Перезапустить аудит' : 'Продолжить' }}</Button>
                <Button v-if="busy" variant="secondary" size="md" :disabled="stopping" @click="stopAudit">Остановить аудит</Button>
                <Button variant="primary" size="md" :disabled="busy" @click="startAudit">{{ runButtonLabel }}</Button>
            </div>
        </header>
        <SeoAuditSettings v-model:open="settingsOpen" v-model:exclusions-open="exclusionsOpen" v-model:mode="mode" v-model:page-limit="pageLimit" v-model:crawl-page-limit="crawlPageLimit"
            v-model:exclude-non-indexable="excludeNonIndexable" v-model:exclusion-lists="exclusionLists" :disabled="busy && state !== 'paused'" :paused="state === 'paused'"
            :minimum-limit="minimumLimit" :minimum-crawl-limit="minimumCrawlLimit" @normalize="normalizeLimits" />
        <Notification v-if="settingsError" :text="settingsError" />
        <EmptyState v-if="state === 'unavailable'" title="Страница недоступна для анализа." :description="message" />
        <Notification v-else-if="state === 'error'" :text="message" />
        <SeoAuditProgress v-if="busy" :audit="audit" :progress="progress" :paused="state === 'paused'" />
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

<script setup>
import { computed, ref, watch } from 'vue'
import { AUDIT_HTTP_FILTERS, AUDIT_KIND_LABELS, auditResultsCsv, filterAuditResults, paginateAuditResults } from '../utils/seoAuditResults.js'
import { summarizeAuditPages } from '../utils/seoAuditPages.js'
import { evaluateHttpStatus } from '../utils/seoValidation.js'
import { downloadText } from '../utils/seoClient.js'
import Button from '../popup/components/ui/Button.vue'
import Card from '../popup/components/ui/Card.vue'
import Select from '../popup/components/ui/Select.vue'
import SeoAuditSources from './SeoAuditSources.vue'
import SeoAuditPagination from './SeoAuditPagination.vue'
import HoverHint from '../popup/components/ui/HoverHint.vue'

const props = defineProps({
    results: { type: Array, default: () => [] },
    mode: String,
    pageUrl: { type: String, default: '' }
})
const status = ref('all'), kind = ref('all'), query = ref(''), page = ref(1), pageSize = ref(25)
const table = ref(null)
const directionLabels = { internal: 'Внутренняя', external: 'Внешняя', service: 'Служебная' }
const origin = computed(() => {
    try { return new URL(props.pageUrl).origin } catch { return '' }
})
const directionOf = item => {
    if (!/^https?:/i.test(item.url)) return 'service'
    try { return new URL(item.url).origin === origin.value ? 'internal' : 'external' } catch { return 'service' }
}
const httpHint = item => evaluateHttpStatus(item.status, item.redirected).hint
const filtered = computed(() => filterAuditResults(props.results, { status: status.value, kind: kind.value, query: query.value }))
const pagination = computed(() => paginateAuditResults(filtered.value, page.value, pageSize.value))
const summary = computed(() => summarizeAuditPages(props.results))
const redirects = computed(() => props.results.filter(item => item.redirected === true).length)
watch([status, kind, query, pageSize], () => { page.value = 1 })
watch(() => pagination.value.page, value => { page.value = value })
watch([() => pagination.value.page, status, kind, query, pageSize], () => { table.value?.scrollTo({ top: 0, left: 0 }) }, { flush: 'post' })
const exportCsv = () => downloadText(
    auditResultsCsv(filtered.value, item => directionLabels[directionOf(item)]),
    `seo-audit-links-${props.mode || 'pages'}-${new Date().toISOString().slice(0, 10)}.csv`,
    'text/csv;charset=utf-8'
)
</script>
<template>
    <Card title="Ссылки и проверенные URL">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p class="text-xs text-ui-muted">Всего: {{ results.length }} · 4xx: {{ summary.clientErrors }} · 404/410: {{ summary.broken }} · 5xx: {{ summary.serverErrors }} · редиректы: {{ redirects }} · неизвестно: {{ summary.uncertain }}</p>
            <Button variant="secondary" size="sm" :disabled="!filtered.length" @click="exportCsv">Скачать CSV ({{ filtered.length }})</Button>
        </div>
        <div class="mb-3 grid gap-2 sm:grid-cols-3">
            <label class="grid gap-1 text-xs text-ui-muted">Поиск URL или страницы-источника<input v-model="query" type="search" class="ui-field" placeholder="Адрес или часть пути" /></label>
            <label class="grid gap-1 text-xs text-ui-muted">HTTP-статус<Select v-model="status" aria-label="HTTP-статус"><option v-for="item in AUDIT_HTTP_FILTERS" :key="item.value" :value="item.value">{{ item.label }}</option></Select></label>
            <label class="grid gap-1 text-xs text-ui-muted">Тип URL<Select v-model="kind" aria-label="Тип URL"><option value="all">Все типы</option><option v-for="(label,value) in AUDIT_KIND_LABELS" :key="value" :value="value">{{ label }}</option></Select></label>
        </div>
        <p class="mb-2 text-xs text-ui-muted" role="status">Найдено по фильтрам: {{ filtered.length }} из {{ results.length }}. Показаны {{ pagination.start }}–{{ pagination.end }}.</p>
        <p v-if="!filtered.length" class="py-3 text-xs text-ui-muted">По выбранным фильтрам результатов нет.</p>
        <div v-else ref="table" tabindex="0" role="region" aria-label="Проверенные ссылки, HTTP-статусы и страницы-источники" class="audit-table-wrapper rounded-control border border-ui-border focus-visible:outline-2 focus-visible:outline-ui-accent">
            <table class="w-full table-fixed border-separate border-spacing-0 text-left text-xs">
                <caption class="sr-only">Проверенные ссылки и URL, HTTP-статусы и страницы, на которых найдена ссылка</caption>
                <thead class="sticky top-0 z-10 bg-ui-raised text-ui-muted"><tr><th scope="col" class="w-[40%] p-2 font-medium">URL и тип</th><th scope="col" class="w-[25%] p-2 font-medium">Ответ и пояснение</th><th scope="col" class="w-[35%] p-2 font-medium">Где найдена ссылка</th></tr></thead>
                <tbody>
                    <tr v-for="link in pagination.items" :key="link.url" data-audit-result>
                        <th scope="row" class="min-w-0 border-t border-ui-border/60 bg-ui-panel p-2 align-top font-normal">
                            <a :href="link.url" :title="link.url" target="_blank" rel="noreferrer" class="block wrap-anywhere text-ui-accent">{{ link.url }}</a>
                            <span class="mt-1 block text-[11px] text-ui-muted">{{ AUDIT_KIND_LABELS[link.kind] || 'Тип не определён' }}</span>
                            <a v-if="link.redirected" :href="link.finalUrl" :title="link.finalUrl" target="_blank" rel="noreferrer" class="mt-1 block wrap-anywhere text-ui-muted">→ {{ link.finalUrl }}</a>
                        </th>
                        <td data-label="Ответ и пояснение" class="border-t border-ui-border/60 p-2 align-top">
                            <HoverHint :text="httpHint(link)"><span :class="['broken','server'].includes(link.outcome) ? 'text-ui-danger' : link.outcome === 'ok' ? 'text-ui-success' : 'text-ui-warning'">{{ link.label }}</span></HoverHint>
                            <span v-if="link.ttfb != null" class="mt-1 block text-[11px] text-ui-muted">До заголовков: {{ link.ttfb }} мс</span>
                            <span v-if="link.metaReason && link.kind === 'page'" class="mt-1 block text-[11px] text-ui-muted">{{ link.metaReason }}</span>
                        </td>
                        <td data-label="Где найдена ссылка" class="min-w-0 border-t border-ui-border/60 p-2 align-top"><SeoAuditSources :sources="link.sources" :sitemaps="link.sitemaps" :current="link.current" /></td>
                    </tr>
                </tbody>
            </table>
        </div>
        <SeoAuditPagination v-model:page-size="pageSize" :page="pagination.page" :count="pagination.count"
            label="Страницы результатов" size-label="Результатов на странице" class="mt-3" jump @update:page="page = $event" />
    </Card>
</template>
<style src="../styles/seoAuditTable.css"></style>

<script setup>
import { computed, ref, watch } from 'vue'
import { AUDIT_HTTP_FILTERS, AUDIT_KIND_LABELS, auditResultsCsv, filterAuditResults, paginateAuditResults } from '../utils/seoAuditResults.js'
import { summarizeAuditPages } from '../utils/seoAuditPages.js'
import { downloadText } from '../utils/seoClient.js'
import Button from '../popup/components/ui/Button.vue'
import Card from '../popup/components/ui/Card.vue'
import Select from '../popup/components/ui/Select.vue'
import SeoAuditSources from './SeoAuditSources.vue'
const props = defineProps({ results: { type: Array, default: () => [] }, mode: String })
const status = ref('all'), kind = ref('all'), query = ref(''), page = ref(1), pageSize = ref(25)
const table = ref(null)
const filtered = computed(() => filterAuditResults(props.results, { status: status.value, kind: kind.value, query: query.value }))
const pagination = computed(() => paginateAuditResults(filtered.value, page.value, pageSize.value))
const summary = computed(() => summarizeAuditPages(props.results))
watch([status, kind, query, pageSize], () => { page.value = 1 })
watch(() => pagination.value.page, value => { page.value = value })
watch([() => pagination.value.page, status, kind, query, pageSize], () => { table.value?.scrollTo({ top: 0, left: 0 }) }, { flush: 'post' })
const exportCsv = () => downloadText(auditResultsCsv(filtered.value), `seo-audit-${props.mode || 'pages'}-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8')
</script>
<template>
    <Card :title="mode === 'external' ? 'HTTP-проверка внешних ссылок' : 'HTTP-проверка URL'">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p class="text-xs text-ui-muted">4xx: {{ summary.clientErrors }} · 404/410: {{ summary.broken }} · 5xx: {{ summary.serverErrors }} · Ограничения / неизвестно: {{ summary.uncertain }}</p>
            <Button variant="secondary" size="sm" :disabled="!filtered.length" @click="exportCsv">Скачать CSV ({{ filtered.length }})</Button>
        </div>
        <div class="mb-3 grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <label class="grid gap-1 text-xs text-ui-muted">Поиск URL или страницы-источника<input v-model="query" type="search" class="ui-field" placeholder="Адрес или часть пути" /></label>
            <label class="grid gap-1 text-xs text-ui-muted">HTTP-статус<Select v-model="status" aria-label="HTTP-статус"><option v-for="item in AUDIT_HTTP_FILTERS" :key="item.value" :value="item.value">{{ item.label }}</option></Select></label>
            <label class="grid gap-1 text-xs text-ui-muted">Тип URL<Select v-model="kind" aria-label="Тип URL"><option value="all">Все типы</option><option v-for="(label,value) in AUDIT_KIND_LABELS" :key="value" :value="value">{{ label }}</option></Select></label>
        </div>
        <p class="mb-2 text-xs text-ui-muted" role="status">Найдено по фильтрам: {{ filtered.length }} из {{ results.length }}. Показаны {{ pagination.start }}–{{ pagination.end }}.</p>
        <p v-if="!filtered.length" class="py-3 text-xs text-ui-muted">По выбранным фильтрам результатов нет.</p>
        <div v-else ref="table" tabindex="0" role="region" aria-label="HTTP-результаты и страницы-источники" class="audit-table-wrapper rounded-control border border-ui-border focus-visible:outline-2 focus-visible:outline-ui-accent">
            <table class="w-full table-fixed border-separate border-spacing-0 text-left text-xs">
                <caption class="sr-only">Проверенные URL, HTTP-статусы и страницы, на которых найдена ссылка</caption>
                <thead class="sticky top-0 z-10 bg-ui-raised text-ui-muted"><tr><th scope="col" class="w-[42%] p-2 font-medium">URL и тип</th><th scope="col" class="w-[23%] p-2 font-medium">Ответ сервера</th><th scope="col" class="w-[35%] p-2 font-medium">Где найдена ссылка</th></tr></thead>
                <tbody>
                    <tr v-for="link in pagination.items" :key="link.url" data-audit-result>
                        <th scope="row" class="min-w-0 border-t border-ui-border/60 bg-ui-panel p-2 align-top font-normal">
                            <a :href="link.url" :title="link.url" target="_blank" rel="noreferrer" class="block wrap-anywhere text-ui-accent">{{ link.url }}</a>
                            <span class="mt-1 block text-[11px] text-ui-muted">{{ AUDIT_KIND_LABELS[link.kind] || 'Тип не определён' }}</span>
                            <a v-if="link.redirected" :href="link.finalUrl" :title="link.finalUrl" target="_blank" rel="noreferrer" class="mt-1 block wrap-anywhere text-ui-muted">→ {{ link.finalUrl }}</a>
                        </th>
                        <td class="border-t border-ui-border/60 p-2 align-top"><span :class="['broken','server'].includes(link.outcome) ? 'text-ui-danger' : link.outcome === 'ok' ? 'text-ui-success' : 'text-ui-warning'">{{ link.label }}</span><span v-if="link.ttfb != null" class="mt-1 block text-[11px] text-ui-muted">До заголовков: {{ link.ttfb }} мс</span><span v-if="link.metaReason && link.kind === 'page'" class="mt-1 block text-[11px] text-ui-muted">{{ link.metaReason }}</span></td>
                        <td class="min-w-0 border-t border-ui-border/60 p-2 align-top"><SeoAuditSources :sources="link.sources" :sitemaps="link.sitemaps" :current="link.current" /></td>
                    </tr>
                </tbody>
            </table>
        </div>
        <nav class="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs" aria-label="Страницы HTTP-результатов">
            <label class="flex items-center gap-2 text-ui-muted">На странице<Select v-model="pageSize" aria-label="Результатов на странице" class="w-20"><option :value="25">25</option><option :value="50">50</option><option :value="100">100</option></Select></label>
            <div class="flex flex-wrap items-center gap-2">
                <Button variant="secondary" size="sm" :disabled="pagination.page === 1" aria-label="Первая страница результатов" @click="page = 1">«</Button>
                <Button variant="secondary" size="sm" :disabled="pagination.page === 1" @click="page = pagination.page - 1">Назад</Button>
                <span aria-live="polite">{{ pagination.page }} / {{ pagination.count }}</span>
                <Button variant="secondary" size="sm" :disabled="pagination.page >= pagination.count" @click="page = pagination.page + 1">Далее</Button>
                <Button variant="secondary" size="sm" :disabled="pagination.page >= pagination.count" aria-label="Последняя страница результатов" @click="page = pagination.count">»</Button>
            </div>
        </nav>
    </Card>
</template>
<style scoped>
.audit-table-wrapper { overflow: auto; max-inline-size: 100%; max-block-size: 38rem; container-type: inline-size; }
tbody th { position: sticky; inset-inline-start: 0; }
@container (width < 560px) {
    table, tbody, tr, th, td { display: block; inline-size: 100%; }
    thead { display: none; }
    tbody th { position: static; }
    td::before { display: block; margin-block-end: .25rem; color: var(--color-ui-muted); }
    td:nth-child(2)::before { content: 'Ответ сервера: '; }
    td:nth-child(3)::before { content: 'Где найдена ссылка: '; }
    tr + tr { border-block-start: 2px solid var(--color-ui-border); }
}
</style>

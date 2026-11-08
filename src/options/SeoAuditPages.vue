<script setup>
import { computed, ref, watch } from 'vue'
import { filterAuditResults, paginateAuditResults, AUDIT_HTTP_FILTERS } from '../utils/seoAuditResults.js'
import { buildAuditPageRows } from '../utils/seoAuditPageRows.js'
import { evaluateHttpStatus } from '../utils/seoValidation.js'
import Card from '../popup/components/ui/Card.vue'
import Select from '../popup/components/ui/Select.vue'
import SeoAuditSources from './SeoAuditSources.vue'
import SeoAuditPageDetails from './SeoAuditPageDetails.vue'
import SeoAuditPagination from './SeoAuditPagination.vue'
const props = defineProps({ results: { type: Array, default: () => [] }, issues: { type: Array, default: () => [] } })
const emit = defineEmits(['select-issue'])
const query = ref(''), status = ref('all'), problemFilter = ref('all'), page = ref(1), pageSize = ref(25), selectedUrl = ref('')
const table = ref(null)
const rows = computed(() => buildAuditPageRows(props.results, props.issues))
const selected = computed(() => rows.value.find(item => item.url === selectedUrl.value))
const filtered = computed(() => filterAuditResults(rows.value, { query: query.value, status: status.value }).filter(row =>
    problemFilter.value === 'problems' ? row.problemCount : problemFilter.value === 'unknown' ? row.metaState !== 'complete' || row.unknownCount
        : problemFilter.value === 'clean' ? row.metaState === 'complete' && !row.issues.length : true))
const pagination = computed(() => paginateAuditResults(filtered.value, page.value, pageSize.value))
const httpHint = row => evaluateHttpStatus(row.status, row.redirected).hint
watch([query, status, problemFilter, pageSize], () => { page.value = 1 })
watch(() => pagination.value.page, value => { page.value = value })
</script>
<template>
    <SeoAuditPageDetails v-if="selected" :page="selected" @back="selectedUrl = ''" @select-issue="emit('select-issue', $event)" />
    <Card v-else title="Просканированные страницы">
        <p class="mb-3 text-xs text-ui-muted">Всего адресов страниц: {{ rows.length }}. Ошибки метаданных определяем только по полному HTML; DOM и показатели скорости относятся к исходной странице.</p>
        <div class="mb-3 grid gap-2 sm:grid-cols-3">
            <label class="grid min-w-0 gap-1 text-xs text-ui-muted">Поиск страницы или источника<input v-model="query" type="search" class="ui-field" placeholder="URL или часть пути" /></label>
            <label class="grid gap-1 text-xs text-ui-muted">HTTP-статус<Select v-model="status" aria-label="HTTP-статус страниц"><option v-for="item in AUDIT_HTTP_FILTERS" :key="item.value" :value="item.value">{{ item.label }}</option></Select></label>
            <label class="grid gap-1 text-xs text-ui-muted">Ошибки страницы<Select v-model="problemFilter" aria-label="Ошибки страницы"><option value="all">Все страницы</option><option value="problems">С ошибками и рекомендациями</option><option value="unknown">Недостаточно данных</option><option value="clean">Без найденных проблем</option></Select></label>
        </div>
        <p class="mb-2 text-xs text-ui-muted" role="status">Найдено: {{ filtered.length }} из {{ rows.length }}. Показаны {{ pagination.start }}–{{ pagination.end }}.</p>
        <p v-if="!filtered.length" class="py-3 text-xs text-ui-muted">{{ rows.length ? 'По выбранным фильтрам страниц нет.' : 'Страницы ещё не получены. Запросы продолжаются либо доступные страницы исключены из обхода.' }}</p>
        <div v-else ref="table" tabindex="-1" role="region" aria-label="Страницы сайта, HTTP, ошибки и источники" class="audit-table-wrapper rounded-control border border-ui-border focus-visible:outline-2 focus-visible:outline-ui-accent">
            <table class="w-full table-fixed border-separate border-spacing-0 text-left text-xs">
                <caption class="sr-only">Просканированные страницы и найденные на них проблемы</caption>
                <thead class="sticky top-0 z-10 bg-ui-raised text-ui-muted"><tr><th scope="col" class="w-[30%] p-2 font-medium">URL</th><th scope="col" class="w-[15%] p-2 font-medium">HTTP</th><th scope="col" class="w-[30%] p-2 font-medium">Ошибки / рекомендации</th><th scope="col" class="w-[25%] p-2 font-medium">Источник ссылки</th></tr></thead>
                <tbody>
                    <tr v-for="row in pagination.items" :key="row.url" data-audit-page>
                        <th scope="row" class="min-w-0 border-t border-ui-border/60 bg-ui-panel p-2 align-top font-normal">
                            <button type="button" class="block text-left wrap-anywhere text-ui-accent hover:underline" @click="selectedUrl = row.url">{{ row.url }}</button>
                            <a :href="row.url" target="_blank" rel="noreferrer" class="mt-1 block text-[11px] text-ui-muted hover:text-ui-accent">Открыть страницу ↗</a>
                        </th>
                        <td data-label="HTTP" class="border-t border-ui-border/60 p-2 align-top"><span :class="row.status >= 400 ? 'text-ui-danger' : row.status === 200 ? 'text-ui-success' : 'text-ui-warning'">{{ row.status || 'Не получен' }}</span><p class="mt-1 text-[11px] text-ui-muted">{{ httpHint(row) }}</p></td>
                        <td data-label="Ошибки / рекомендации" class="border-t border-ui-border/60 p-2 align-top">
                            <button type="button" class="ui-link" @click="selectedUrl = row.url">{{ row.problemCount }} · Карточка страницы →</button>
                            <ul v-if="row.problems.length" class="mt-1 grid gap-1"><li v-for="issue in row.problems.slice(0, 3)" :key="issue.id"><button type="button" class="text-left text-[11px] text-ui-warning hover:underline" @click="emit('select-issue', issue)">{{ issue.label }}</button></li></ul>
                            <p v-if="row.problemCount > 3" class="mt-1 text-[11px] text-ui-muted">Ещё: {{ row.problemCount - 3 }} — в карточке.</p>
                            <p v-if="row.unknownCount" class="mt-1 text-[11px] text-ui-muted">Не удалось подтвердить: {{ row.unknownCount }}</p>
                            <p v-if="row.metaState !== 'complete'" class="mt-1 text-[11px] text-ui-muted">{{ row.metaReason || 'Полный HTML не получен' }}</p>
                        </td>
                        <td data-label="Источник ссылки" class="min-w-0 border-t border-ui-border/60 p-2 align-top"><SeoAuditSources :sources="row.sources" :sitemaps="row.sitemaps" :current="row.current" /></td>
                    </tr>
                </tbody>
            </table>
        </div>
        <SeoAuditPagination v-model:page-size="pageSize" :page="pagination.page" :count="pagination.count"
            label="Страницы списка страниц" size-label="Страниц в таблице" :scroll-target="table" class="mt-3" @update:page="page = $event" />
    </Card>
</template>
<style src="../styles/seoAuditTable.css"></style>

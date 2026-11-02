<script setup>
import { computed, ref, watch } from 'vue'
import { auditAvailabilityCsv, AUDIT_AVAILABILITY_LABELS } from '../utils/seoAuditAvailability.js'
import { paginateAuditResults } from '../utils/seoAuditResults.js'
import { downloadText } from '../utils/seoClient.js'
import Card from '../popup/components/ui/Card.vue'
import Button from '../popup/components/ui/Button.vue'
import Select from '../popup/components/ui/Select.vue'
const props = defineProps({ results: { type: Array, default: () => [] } })
const query = ref(''), status = ref('all'), page = ref(1)
const colors = { available: 'text-ui-success', unavailable: 'text-ui-danger', redirect: 'text-ui-warning', unknown: 'text-ui-muted' }
const filtered = computed(() => props.results.filter(item => (status.value === 'all' || item.availability === status.value)
    && (!query.value.trim() || [item.url, item.redirectUrl || item.location || ''].some(url => url.toLowerCase().includes(query.value.trim().toLowerCase())))))
const pagination = computed(() => paginateAuditResults(filtered.value, page.value))
watch([query, status], () => { page.value = 1 })
watch(() => pagination.value.page, value => { page.value = value })
const exportCsv = () => downloadText(auditAvailabilityCsv(filtered.value), 'seo-external-links.csv', 'text/csv;charset=utf-8')
</script>
<template>
    <Card title="Доступность внешних ссылок">
        <div class="mb-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
            <label class="grid min-w-0 gap-1 text-xs text-ui-muted">Поиск URL<input v-model="query" type="search" class="ui-field" placeholder="Адрес или часть пути" /></label>
            <label class="grid gap-1 text-xs text-ui-muted">Ответ<Select v-model="status" aria-label="Доступность внешних ссылок"><option value="all">Все ответы</option><option v-for="(label, value) in AUDIT_AVAILABILITY_LABELS" :key="value" :value="value">{{ label }}</option></Select></label>
            <Button variant="secondary" size="sm" :disabled="!filtered.length" class="justify-self-start" @click="exportCsv">Скачать CSV ({{ filtered.length }})</Button>
        </div>
        <p class="mb-2 text-xs text-ui-muted" role="status">Проверено {{ results.length }} URL · По фильтру {{ filtered.length }}</p>
        <p v-if="!filtered.length" class="text-xs text-ui-muted">Внешних ссылок по выбранным условиям нет.</p>
        <div v-else tabindex="0" role="region" aria-label="Ответы внешних URL" class="audit-table-wrapper rounded-control border border-ui-border focus-visible:outline-2 focus-visible:outline-ui-accent">
            <table class="w-full table-fixed border-separate border-spacing-0 text-left text-xs">
                <caption class="sr-only">Доступность, HTTP-статусы и адреса перенаправления внешних ссылок</caption>
                <thead class="sticky top-0 z-10 bg-ui-raised text-ui-muted"><tr><th scope="col" class="w-[40%] p-2 font-medium">URL</th><th scope="col" class="w-[25%] p-2 font-medium">Ответ</th><th scope="col" class="w-[35%] p-2 font-medium">Куда ведёт редирект</th></tr></thead>
                <tbody><tr v-for="item in pagination.items" :key="item.url" data-audit-availability>
                    <th scope="row" class="border-t border-ui-border/60 bg-ui-panel p-2 align-top font-normal"><a :href="item.url" target="_blank" rel="noreferrer" class="wrap-anywhere text-ui-accent">{{ item.url }}</a></th>
                    <td data-label="Ответ" class="border-t border-ui-border/60 p-2 align-top"><span :class="colors[item.availability]">{{ item.label }}</span><span class="mt-1 block text-ui-muted">{{ item.status ? `HTTP ${item.status}` : 'HTTP-ответ не получен' }}</span></td>
                    <td data-label="Куда ведёт редирект" class="border-t border-ui-border/60 p-2 align-top"><a v-if="item.redirectUrl" :href="item.redirectUrl" target="_blank" rel="noreferrer" class="wrap-anywhere text-ui-accent">{{ item.redirectUrl }}</a><span v-else class="wrap-anywhere text-ui-muted">{{ item.location || (item.redirected ? 'Адрес не получен' : '—') }}</span></td>
                </tr></tbody>
            </table>
        </div>
        <nav v-if="pagination.count > 1" class="mt-3 flex items-center gap-2 text-xs" aria-label="Страницы внешних ссылок"><Button variant="secondary" size="sm" :disabled="pagination.page === 1" @click="page--">Назад</Button><span>{{ pagination.page }} / {{ pagination.count }}</span><Button variant="secondary" size="sm" :disabled="pagination.page === pagination.count" @click="page++">Далее</Button></nav>
    </Card>
</template>
<style src="../styles/seoAuditTable.css"></style>

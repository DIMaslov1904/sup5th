<script setup>
import { computed } from 'vue'
import { evaluateHttpStatus } from '../../utils/seoValidation.js'
import PropertyList from './ui/PropertyList.vue'
const props = defineProps({ report: { type: Object, required: true } })
const rows = computed(() => props.report.response.chain?.length ? props.report.response.chain : [{ url: props.report.finalUrl || props.report.url, status: props.report.response.status, headers: props.report.response.headers || {} }])
const headers = computed(() => [
    { label: 'X-Robots-Tag', value: props.report.xRobots || 'Не задан' },
    ...Object.entries(props.report.response.headers || {}).filter(([key]) => key !== 'x-robots-tag').map(([label, value]) => ({ label, value }))
])
const colors = { success: 'text-ui-success', warning: 'text-ui-warning', danger: 'text-ui-danger' }
</script>
<template>
    <details class="ui-panel text-xs">
        <summary class="cursor-pointer text-ui-accent">HTTP-заголовки и редиректы</summary>
        <p v-if="report.response.pending" class="mt-3 text-ui-muted" role="status">Проверяем HTTP…</p>
        <div v-else class="mt-3 grid min-w-0 gap-3">
            <p class="wrap-anywhere"><span class="text-ui-muted">Исходный URL: </span>{{ report.url }}</p>
            <ol class="grid gap-2" aria-label="Цепочка HTTP-ответов">
                <li v-for="(item, index) in rows" :key="`${index}:${item.url}`" class="grid min-w-0 gap-1 rounded-control border border-ui-border p-2">
                    <p class="wrap-anywhere"><strong :class="colors[evaluateHttpStatus(item.status).status]">{{ item.status || '?' }}</strong> · {{ item.url }}</p>
                    <p v-if="item.redirectUrl" class="wrap-anywhere text-ui-muted">→ {{ item.redirectUrl }}</p>
                    <details v-if="item.redirectUrl && Object.keys(item.headers || {}).length"><summary class="cursor-pointer text-ui-accent">Заголовки перехода</summary><PropertyList class="mt-2" :items="Object.entries(item.headers).map(([label,value]) => ({label,value}))" /></details>
                </li>
            </ol>
            <p v-if="!report.response.traceComplete" class="text-ui-warning">Полная цепочка недоступна.</p>
            <PropertyList :items="headers" />
        </div>
    </details>
</template>

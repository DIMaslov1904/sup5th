<script setup>
import { computed, ref, watch } from 'vue'
import { evaluateHttpStatus } from '../utils/seoValidation.js'
import { AUDIT_KIND_LABELS } from '../utils/seoAuditResults.js'
import Button from '../popup/components/ui/Button.vue'
import Card from '../popup/components/ui/Card.vue'
import Input from '../popup/components/ui/Input.vue'
import PropertyList from '../popup/components/ui/PropertyList.vue'

const props = defineProps({ issue: { type: Object, required: true }, audit: Object })
const emit = defineEmits(['back'])
const statusLabels = { pass: 'Подтверждено', fail: 'Ошибка', warning: 'Рекомендация', unknown: 'Неизвестно', na: 'Не применимо' }
const colors = { pass: 'text-ui-success', fail: 'text-ui-danger', warning: 'text-ui-warning', unknown: 'text-ui-muted', na: 'text-ui-muted' }
const severityLabels = { critical: 'критично', warning: 'важно', info: 'инфо' }
const severityClasses = { critical: 'text-ui-danger', warning: 'text-ui-warning', info: 'text-ui-muted' }
const query = ref(''), visible = ref(100)
watch(query, () => { visible.value = 100 })

const resultByUrl = computed(() => {
    const map = new Map()
    for (const item of props.audit?.results || []) {
        if (!map.has(item.url)) map.set(item.url, item)
        if (item.finalUrl && !map.has(item.finalUrl)) map.set(item.finalUrl, item)
    }
    for (const item of props.audit?.pageResults || []) {
        if (!map.has(item.url)) map.set(item.url, item)
        if (item.finalUrl && !map.has(item.finalUrl)) map.set(item.finalUrl, item)
    }
    return map
})
const rows = computed(() => props.issue.urls.map(url => {
    const result = resultByUrl.value.get(url) || null
    return { url, result, hint: result ? evaluateHttpStatus(result.status, result.redirected).hint : '' }
}))
const filtered = computed(() => {
    const needle = query.value.trim().toLowerCase()
    return needle ? rows.value.filter(row => row.url.toLowerCase().includes(needle)) : rows.value
})
const shown = computed(() => filtered.value.slice(0, visible.value))
const plural = (count, forms) => {
    const abs = Math.abs(count) % 100, last = abs % 10
    if (abs > 10 && abs < 20) return forms[2]
    if (last > 1 && last < 5) return forms[1]
    return last === 1 ? forms[0] : forms[2]
}
const addressesLabel = computed(() => `${props.issue.urlCount} ${plural(props.issue.urlCount, ['адрес', 'адреса', 'адресов'])}`)
const kindLabel = item => item?.kind ? (AUDIT_KIND_LABELS[item.kind] || item.kind) : ''
const statusLabel = item => item?.label || (item?.status ? `HTTP ${item.status}` : 'Нет HTTP-ответа')
const sourceText = item => {
    const sources = item?.sources || []
    if (!sources.length) return ''
    return sources.slice(0, 2).join(', ') + (sources.length > 2 ? ` +${sources.length - 2}` : '')
}
const helpRows = computed(() => [
    ...(props.issue.help?.why ? [{ label: 'Почему важно', value: props.issue.help.why }] : []),
    ...(props.issue.help?.how ? [{ label: 'Что делать', value: props.issue.help.how }] : [])
])
</script>
<template>
    <div class="grid min-w-0 gap-3">
        <div class="flex flex-wrap items-center gap-2 text-xs">
            <Button variant="ghost" size="sm" @click="emit('back')">← К ошибкам</Button>
            <span class="text-ui-muted">Ошибки /</span>
            <span class="min-w-0 wrap-anywhere">{{ issue.label }}</span>
        </div>
        <Card :title="`${issue.label} · ${addressesLabel}`">
            <div class="grid gap-3">
                <div class="flex flex-wrap items-center gap-2 text-xs">
                    <span :class="colors[issue.status]" class="font-medium">{{ statusLabels[issue.status] }}</span>
                    <span :class="severityClasses[issue.severity]">· {{ severityLabels[issue.severity] }}</span>
                    <span v-if="issue.hint" class="min-w-0 text-ui-muted wrap-anywhere">· {{ issue.hint }}</span>
                </div>
                <PropertyList v-if="helpRows.length" :items="helpRows" />
                <label class="grid gap-1 text-xs text-ui-muted">Поиск по адресу<Input v-model="query" placeholder="URL или часть пути" /></label>
                <p class="text-xs text-ui-muted" role="status">Показано {{ shown.length }} из {{ filtered.length }}<template v-if="filtered.length !== issue.urlCount"> (всего в проблеме {{ issue.urlCount }})</template>.</p>
                <p v-if="!filtered.length" class="text-xs text-ui-muted">По этому запросу адресов нет.</p>
                <ul v-else class="grid min-w-0 gap-2">
                    <li v-for="row in shown" :key="row.url" class="grid min-w-0 gap-1 rounded-control border border-ui-border bg-ui-field/40 px-3 py-2 text-xs">
                        <a :href="row.url" target="_blank" rel="noreferrer" class="break-all text-ui-accent">{{ row.url }}</a>
                        <div class="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ui-muted">
                            <span v-if="row.result">{{ statusLabel(row.result) }}</span>
                            <span v-if="row.result?.kind">{{ kindLabel(row.result) }}</span>
                            <span v-if="row.result?.redirected && row.result.finalUrl">→ {{ row.result.finalUrl }}</span>
                            <span v-if="sourceText(row.result)">Источники: {{ sourceText(row.result) }}</span>
                        </div>
                        <p v-if="row.hint" class="text-[11px] text-ui-muted">{{ row.hint }}</p>
                    </li>
                </ul>
                <Button v-if="filtered.length > visible" variant="secondary" size="sm" class="justify-self-start" @click="visible += 100">Показать ещё 100</Button>
            </div>
        </Card>
    </div>
</template>

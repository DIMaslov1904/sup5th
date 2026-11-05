<script setup>
import { computed } from 'vue'
import { primaryMetadata, advancedMetadata, evaluateHttpStatus } from '../../utils/seoValidation.js'
import { pageWeightRows } from '../../utils/pageWeightDisplay.js'
import { cwvMetrics, cwvMissingHint } from '../../utils/cwv.js'
import PropertyList from './ui/PropertyList.vue'
import Card from './ui/Card.vue'
import SeoAnalyticsCard from './SeoAnalyticsCard.vue'

const props = defineProps({ report: { type: Object, required: true }, hideUnavailableMetrics: Boolean })
const metricColors = { good: 'success', 'needs-fix': 'warning', poor: 'danger' }
const metricsHint = computed(() => cwvMissingHint(props.report.cwv, props.report.source))

const page = computed(() => {
    const data = props.report
    return [
        { label: 'URL', value: data.url, copyValue: data.url },
        { label: 'Base', value: data.baseDisplay + (data.baseDeclared ? '' : ' (не задан)') },
        { label: 'IP сервера', value: data.response.pending ? 'Определяем…' : data.response.ip || 'Не получен' },
        { label: 'HTTP', value: data.response.pending ? 'Проверяем…' : data.response.status || 'Не получен', ...(data.response.pending ? {} : evaluateHttpStatus(data.response.status, data.redirected)) },
        { label: 'Редирект', value: data.response.pending ? 'Проверяем…' : data.redirected ? data.finalUrl : 'Нет' },
        {
            label: 'Протокол',
            value: data.ssl?.https ? 'HTTPS' : 'HTTP',
            ...(data.ssl?.https ? { status: 'success', hint: 'Страница открыта по HTTPS' } : { status: 'danger', hint: 'Страница открыта по HTTP — передаваемые данные не защищены' })
        },
        {
            label: 'Mixed content',
            value: data.ssl?.https ? (data.ssl.mixedContent ? `${data.ssl.mixedContent} незащищённых ресурсов` : 'Не найден') : '—',
            ...(data.ssl?.mixedContent ? { status: 'warning', hint: 'Часть ресурсов (img, script, iframe и др.) загружается по HTTP' } : {})
        },
        { label: 'Кодировка', ...charsetRow(data) },
        { label: 'Проверено', value: new Date(data.scannedAt).toLocaleString('ru-RU') },
        { label: data.source === 'html' ? 'TTFB запроса HTML' : 'TTFB повторного запроса', value: data.response.ttfb == null ? 'Не измерен' : data.response.ttfb + ' мс' },
        ...pageWeightRows(data.pageWeight),
        ...cwvMetrics(data.cwv).filter(metric => metric.value || (!props.hideUnavailableMetrics && data.source !== 'html')).map(metric => ({
            label: metric.name, value: metric.value || metric.unavailable, status: metricColors[metric.rating], hint: metric.hint
        }))
    ]
})

const charsetRow = data => {
    const meta = data.charset?.document || data.charset?.meta || '', http = data.charset?.http || ''
    if (!meta && !http) return { value: 'Не объявлена', status: 'warning', hint: 'Meta charset и HTTP charset не найдены; браузер определяет кодировку эвристически' }
    const value = [meta && `meta: ${meta}`, http && `HTTP: ${http}`].filter(Boolean).join(' · ')
    return data.charset?.consistent === false
        ? { label: 'Кодировка', value, status: 'danger', hint: 'Объявления кодировки в meta и HTTP не совпадают' }
        : { label: 'Кодировка', value }
}
const primary = computed(() => primaryMetadata(props.report))
const advanced = computed(() => [
    { label: 'Язык', value: props.report.lang || 'Не указан' },
    ...advancedMetadata(props.report)
])
</script>
<template>
    <Card title="Метаданные страницы">
        <PropertyList :items="primary" />
        <details class="mt-3 border-t border-ui-border/70 pt-3 text-xs">
            <summary class="cursor-pointer text-ui-accent">Расширенное ({{ advanced.length }})</summary>
            <PropertyList :items="advanced" class="mt-3" />
        </details>
    </Card>
    <SeoAnalyticsCard :analytics="report.analytics" :source="report.source" />
    <Card title="Данные страницы">
        <PropertyList :items="page" />
        <p v-if="metricsHint" class="mt-3 text-xs text-ui-muted">{{ metricsHint }}</p>
    </Card>
</template>

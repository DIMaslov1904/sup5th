<script setup>
import { computed } from 'vue'
import { primaryMetadata, advancedMetadata, evaluateHttpStatus } from '../../utils/seoValidation.js'
import { pageWeightRows } from '../../utils/pageWeightDisplay.js'
import PropertyList from './ui/PropertyList.vue'
import Card from './ui/Card.vue'
import SeoHttpDetails from './SeoHttpDetails.vue'

const props = defineProps({ report: { type: Object, required: true }, serverIp: String, serverIpLoading: Boolean })
const primary = computed(() => primaryMetadata(props.report))
const advanced = computed(() => [
    { label: 'Язык', value: props.report.lang || 'Не указан' },
    ...advancedMetadata(props.report)
])
const page = computed(() => {
    const data = props.report
    return [
        { label: 'URL', value: data.url, copyValue: data.url },
        { label: 'Base', value: data.baseDisplay + (data.baseDeclared ? '' : ' (не задан)') },
        { label: 'IP сервера', value: props.serverIpLoading ? 'Определяем…' : props.serverIp || 'Не получен' },
        { label: 'HTTP', value: data.response.pending ? 'Проверяем…' : data.response.status || 'Не получен', ...(data.response.pending ? {} : evaluateHttpStatus(data.response.status, data.redirected)) },
        { label: 'Редирект', value: data.response.pending ? 'Проверяем…' : data.redirected ? data.finalUrl : 'Нет' },
        { label: 'Проверено', value: new Date(data.scannedAt).toLocaleString('ru-RU') },
        { label: 'TTFB повторного запроса', value: data.response.ttfb == null ? 'Не измерен' : data.response.ttfb + ' мс' },
        ...pageWeightRows(data.pageWeight)
    ]
})
</script>
<template>
    <Card title="Метаданные страницы">
        <PropertyList :items="primary" />
        <details class="mt-3 border-t border-ui-border/70 pt-3 text-xs">
            <summary class="cursor-pointer text-ui-accent">Расширенное ({{ advanced.length }})</summary>
            <PropertyList :items="advanced" class="mt-3" />
        </details>
    </Card>
    <Card title="Данные страницы"><PropertyList :items="page" /></Card>
    <SeoHttpDetails :report="report" />
</template>

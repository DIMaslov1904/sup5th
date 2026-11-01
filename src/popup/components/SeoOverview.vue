<script setup>
import { computed } from 'vue'
import { primaryMetadata, advancedMetadata, evaluateHttpStatus } from '../../utils/seoValidation.js'
import { pageWeightRows } from '../../utils/pageWeightDisplay.js'
import PropertyList from './ui/PropertyList.vue'
import Card from './ui/Card.vue'
import SeoHttpDetails from './SeoHttpDetails.vue'

const props = defineProps({ report: { type: Object, required: true }, serverIp: String, serverIpLoading: Boolean })

const page = computed(() => {
    const data = props.report
    const rows = [
        { label: 'URL', value: data.url, copyValue: data.url },
        { label: 'Base', value: data.baseDisplay + (data.baseDeclared ? '' : ' (не задан)') },
        { label: 'IP сервера', value: props.serverIpLoading ? 'Определяем…' : props.serverIp || 'Не получен' },
        { label: 'HTTP', value: data.response.pending ? 'Проверяем…' : data.response.status || 'Не получен', ...(data.response.pending ? {} : evaluateHttpStatus(data.response.status, data.redirected)) },
        { label: 'Редирект', value: data.response.pending ? 'Проверяем…' : data.redirected ? data.finalUrl : 'Нет' },
        { label: 'Проверено', value: new Date(data.scannedAt).toLocaleString('ru-RU') },
        { label: 'TTFB повторного запроса', value: data.response.ttfb == null ? 'Не измерен' : data.response.ttfb + ' мс' },
        ...pageWeightRows(data.pageWeight)
    ]
    // Core Web Vitals at the bottom
    const cwv = data.cwv
    if (cwv) {
        if (cwv.lcp) {
            rows.push({
                label: 'LCP',
                value: `${(cwv.lcp.value / 1000).toFixed(2)}с`,
                status: cwv.lcp.rating === 'good' ? 'success' : cwv.lcp.rating === 'poor' ? 'danger' : 'warning',
                hint: cwv.lcp.element ? `Элемент: ${cwv.lcp.element}` : `Ориентир: ≤2.5с / ≤4.0с`
            })
        }
        if (cwv.cls != null) {
            rows.push({
                label: 'CLS',
                value: cwv.cls.toFixed(3),
                status: cwv.clsRating === 'good' ? 'success' : cwv.clsRating === 'poor' ? 'danger' : 'warning',
                hint: `Сдвиг макета за время загрузки; ориентир ≤0.05 / ≤0.25`
            })
        }
        if (cwv.inp) {
            rows.push({
                label: 'INP',
                value: `${cwv.inp.value}мс`,
                status: cwv.inp.rating === 'good' ? 'success' : cwv.inp.rating === 'poor' ? 'danger' : 'warning',
                hint: cwv.inp.note || `Отклик на взаимодействие; ориентир ≤200мс / ≤500мс`
            })
        }
        if (cwv.fcp) {
            rows.push({
                label: 'FCP',
                value: `${(cwv.fcp.value / 1000).toFixed(2)}с`,
                status: cwv.fcp.rating === 'good' ? 'success' : cwv.fcp.rating === 'poor' ? 'danger' : 'warning',
                hint: `Первый видимый контент; ориентир ≤1.8с / ≤3.0с`
            })
        }
    }
    return rows
})

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
    <Card title="Данные страницы"><PropertyList :items="page" /></Card>
</template>

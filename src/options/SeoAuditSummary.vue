<script setup>
import { computed } from 'vue'
import { AUDIT_MODES } from '../utils/seoAuditLinks.js'
import { summarizeAuditChecks } from '../utils/seoAuditChecks.js'
import { summarizeAuditPages } from '../utils/seoAuditPages.js'
import { cwvMissingHint } from '../utils/cwv.js'
import Card from '../popup/components/ui/Card.vue'
import SeoAnalyticsCard from '../popup/components/SeoAnalyticsCard.vue'
import SeoAuditCounter from './SeoAuditCounter.vue'
import SeoAuditInfo from './SeoAuditInfo.vue'
const props = defineProps({ report: Object, audit: Object, issues: Array, busy: Boolean })
const emit = defineEmits(['select-status'])
const summary = computed(() => summarizeAuditChecks(props.issues || []))
const pages = computed(() => summarizeAuditPages(props.audit.pageResults || props.audit.results))
const mode = computed(() => AUDIT_MODES.find(item => item.value === props.audit.mode)?.label || 'Только страницы')
const metricsHint = computed(() => cwvMissingHint(props.report.cwv, props.report.source))
const help = computed(() => [mode.value, `${props.audit.sample.limit === 0 ? 'Без лимита URL.' : `Лимит URL: ${props.audit.sample.limit}.`} Обход ограничен исходным сайтом.`,
    `Найдено по ссылкам: ${props.audit.sample.linked}; в sitemap: ${props.audit.sample.mapped}.`,
    `${props.report.source === 'html' ? 'HTML' : 'DOM'} исходной страницы: ${new Date(props.report.scannedAt).toLocaleString('ru-RU')}. HTTP-проверки выполняются без cookies.`,
    'Счётчики показывают охват доступных источников и не гарантируют обнаружение всех страниц сайта.'].join('\n\n'))
const complete = computed(() => !props.busy && !props.audit.partial && !props.audit.sample.limited && props.audit.crawl.complete
    && props.audit.results.length >= props.audit.sample.total && props.audit.results.every(item => ['ok', 'broken', 'server'].includes(item.outcome)))
const statuses = [
    { value: 'fail', label: 'Проверки с ошибками', color: 'text-ui-danger' }, { value: 'warning', label: 'Рекомендации', color: 'text-ui-warning' },
    { value: 'pass', label: 'Успешные проверки', color: 'text-ui-success' }, { value: 'unknown', label: 'Не удалось подтвердить', color: 'text-ui-muted' },
    { value: 'na', label: 'Не применимо', color: 'text-ui-muted' }
]
</script>
<template>
    <Card>
        <div class="mb-2 flex items-center justify-between gap-2"><h3 class="text-[13px] font-semibold">Сводка аудита</h3><SeoAuditInfo :text="help" label="Пояснение сводки аудита" /></div>
        <a :href="report.url" :title="report.url" target="_blank" rel="noreferrer" class="mb-3 block truncate text-xs text-ui-accent">{{ report.url }}</a>
        <div role="group" aria-label="Итоги аудита" class="grid grid-cols-2 gap-2 min-[420px]:grid-cols-3 md:grid-cols-5">
            <SeoAuditCounter v-for="item in statuses" :key="item.value" :label="item.label" :count="summary[item.value]" :class="item.color"
                :aria-label="`${item.label} · ${summary[item.value]}. Показать проверки`" :data-audit-summary="item.value" @click="emit('select-status', item.value)" />
        </div>
        <p class="mt-3 text-xs font-semibold">Проверено {{ audit.results.length }} из {{ audit.sample.total }} URL{{ audit.sample.limited ? '+' : '' }} · HTML-страниц: {{ pages.htmlCount }} · Исключено: {{ audit.exclusions?.items.length || 0 }}</p>
        <p v-if="metricsHint" class="mt-2 text-xs text-ui-muted">{{ metricsHint }}</p>
        <p v-if="audit.crawl.unavailable" class="mt-1 text-xs text-ui-warning">Не удалось полностью прочитать страниц для сбора ссылок: {{ audit.crawl.unavailable }}.</p>
        <p class="mt-2 text-xs" :class="complete ? 'text-ui-success' : 'text-ui-warning'">{{ busy ? 'Поиск и проверка продолжаются.' : complete ? 'Обработаны все URL, обнаруженные в доступных источниках.' : 'Проверка неполная: проверьте лимиты, остановку и ограничения доступа.' }}</p>
    </Card>
    <SeoAnalyticsCard :analytics="report.analytics" :source="report.source" />
</template>

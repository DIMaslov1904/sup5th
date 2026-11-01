<script setup>
import { computed } from 'vue'
import { AUDIT_MODES } from '../utils/seoAuditLinks.js'
import { summarizeAuditChecks } from '../utils/seoAuditChecks.js'
import { summarizeAuditPages } from '../utils/seoAuditPages.js'
import Card from '../popup/components/ui/Card.vue'
const props = defineProps({ report: Object, audit: Object, checks: Array, busy: Boolean })
const summary = computed(() => summarizeAuditChecks(props.checks || []))
const pages = computed(() => summarizeAuditPages(props.audit.pageResults || props.audit.results))
const mode = computed(() => AUDIT_MODES.find(item => item.value === props.audit.mode)?.label || 'Только страницы')
const complete = computed(() => !props.busy && !props.audit.partial && !props.audit.sample.limited && props.audit.crawl.complete
    && props.audit.results.length >= props.audit.sample.total && props.audit.results.every(item => ['ok', 'broken', 'server'].includes(item.outcome)))
const statuses = [
    { value: 'fail', label: 'Проверки с ошибками', color: 'text-ui-danger' }, { value: 'warning', label: 'Рекомендации', color: 'text-ui-warning' },
    { value: 'pass', label: 'Успешные проверки', color: 'text-ui-success' }, { value: 'unknown', label: 'Не удалось подтвердить', color: 'text-ui-muted' }
]
</script>
<template>
    <Card title="Сводка аудита">
        <a :href="report.url" :title="report.url" target="_blank" rel="noreferrer" class="mb-3 block truncate text-xs text-ui-accent">{{ report.url }}</a>
        <dl aria-label="Итоги аудита" class="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            <div v-for="item in statuses" :key="item.value" class="rounded-control bg-ui-raised/60 p-3"><dt class="text-ui-muted">{{ item.label }}</dt><dd :class="item.color" class="mt-1 text-2xl font-semibold tabular-nums">{{ summary[item.value] }}</dd></div>
        </dl>
        <p class="mt-3 text-xs font-semibold">{{ mode }} · HTTP-проверено {{ audit.results.length }} из {{ audit.sample.total }} найденных URL{{ audit.sample.limited ? '+' : '' }}</p>
        <p class="mt-1 text-xs text-ui-muted">Обработано внутренних адресов страниц: {{ audit.crawl.current }} из {{ audit.crawl.discovered }}. Полных HTML по уникальным конечным URL: {{ pages.htmlCount }}.</p>
        <p v-if="audit.crawl.unavailable" class="mt-1 text-xs text-ui-warning">Не удалось полностью прочитать страниц для сбора ссылок: {{ audit.crawl.unavailable }}.</p>
        <p v-if="audit.mode !== 'external'" class="mt-1 text-xs text-ui-muted">Гостевой HTML и ссылки: {{ audit.sample.linked }} · Найдено в sitemap: {{ audit.sample.mapped }} · Не встречены в обработанных sitemap: {{ audit.sample.outsideSitemap }}.</p>
        <p class="mt-1 text-xs text-ui-muted">Исключение неиндексируемых страниц: {{ audit.exclusions?.enabled ? 'включено' : 'выключено' }} · Исключено URL: {{ audit.exclusions?.items.length || 0 }}{{ audit.exclusions?.limited ? '+' : '' }}.</p>
        <p class="mt-2 text-xs" :class="complete ? 'text-ui-success' : 'text-ui-warning'">{{ busy ? 'Поиск и проверка продолжаются.' : complete ? 'Обработаны все URL, обнаруженные в доступных источниках.' : 'Проверка неполная: проверьте лимиты, остановку и ограничения доступа.' }}</p>
        <p class="mt-1 text-[11px] text-ui-muted">Лимит HTTP-результатов: {{ audit.sample.limit }}<template v-if="audit.mode === 'external'"> · Лимит обхода страниц: {{ audit.crawl.limit }}</template>. Обход ограничен исходным origin. Наличие URL только в sitemap не означает, что на него есть ссылка со страницы.</p>
        <p class="mt-1 text-[11px] text-ui-muted">HTTP и сбор ссылок: гостевые GET без cookies. DOM открытой вкладки от {{ new Date(report.scannedAt).toLocaleString('ru-RU') }} используется только для отдельных проверок страницы. Счётчики не гарантируют охват всего сайта.</p>
    </Card>
</template>

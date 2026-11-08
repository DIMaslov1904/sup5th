<script setup>
import { computed } from 'vue'
import { normalizeAuditUrl } from '../utils/seoAuditLinks.js'
import { evaluateRobotsFile } from '../utils/seoRules.js'
import SeoAuditFileCard from './SeoAuditFileCard.vue'
import SitemapDuplicates from './SitemapDuplicates.vue'
import SeoAuditInfo from './SeoAuditInfo.vue'
const props = defineProps({ audit: Object, report: Object })
const isMissing = status => [404, 410].includes(status)
const failureDetails = { permission: 'Нет разрешения на сайт.', timeout: 'Сервер не ответил вовремя.' }
const describeFile = (file, detail = '') => {
    const summary = { url: file.url, status: file.status, detail: detail || failureDetails[file.failure] }
    if (file.pending) return { ...summary, label: 'Проверяем файл…', tone: 'muted' }
    if (isMissing(file.status)) return { ...summary, label: 'Файл не найден', tone: 'warning' }
    if (file.truncated || file.status === 206) return { ...summary, label: 'Файл прочитан частично', tone: 'warning' }
    if (file.invalid) return { ...summary, label: 'Некорректный формат', tone: 'danger' }
    if (file.exists && !file.failure) return { ...summary, label: 'Файл прочитан', tone: 'success' }
    return { ...summary, label: 'Не удалось прочитать файл', tone: 'warning' }
}
const llmCard = computed(() => {
    const file = props.audit.llmTxt || props.report.llmTxt
    if (!file) return null
    const detail = file.invalid ? 'Сервер вернул HTML.' : file.exists && file.size != null ? `${file.size} симв.` : ''
    return describeFile(file, detail)
})
const sitemapRows = computed(() => [
    ...props.audit.sitemap.files.map(file => describeFile({ ...file, exists: true }, file.index ? 'Индекс карт' : `${file.count} URL`)),
    ...props.audit.sitemap.errors.map(error => {
        const detail = error.message === `HTTP ${error.status || 'не получен'}` ? '' : error.message
        return describeFile({
            ...error, invalid: error.kind === 'format' || error.kind === 'declaration', truncated: error.kind === 'truncated'
        }, detail)
    })
].map(row => ({ ...row, href: normalizeAuditUrl(row.url) })))
const sitemapCard = computed(() => {
    const { pending, complete, files, roots } = props.audit.sitemap
    const rows = sitemapRows.value
    const url = roots?.length > 1 ? '' : roots?.[0] || new URL('/sitemap.xml', props.report.url).href
    if (pending || !rows.length) return describeFile({ url, pending })
    if (rows.length === 1) return files.length && !complete ? { ...rows[0], label: 'Обработка неполная', tone: 'warning' } : rows[0]
    if (complete) return { url, label: 'Файлы прочитаны', tone: 'success' }
    if (rows.every(row => isMissing(row.status))) return { url, label: 'Файлы не найдены', tone: 'warning' }
    return { url, label: files.length ? 'Обработка неполная' : 'Не удалось прочитать файлы', tone: 'warning' }
})
const robots = computed(() => ['googlebot', 'yandex'].map(agent => ({ agent, ...evaluateRobotsFile(props.audit.robotsFile, props.report.url, agent) })))
const robotsCard = computed(() => {
    const file = props.audit.robotsFile
    const invalid = file.exists && !file.failure && robots.value.some(group => group.allowed === null)
    return describeFile({ ...file, invalid }, invalid && !file.truncated ? 'Содержимое robots.txt не распознано.' : '')
})
</script>
<template>
    <SeoAuditFileCard v-if="llmCard" title="llm.txt" :file="llmCard" />
    <SeoAuditFileCard title="Sitemap" :file="sitemapCard">
        <template v-if="audit.sitemap.files.length">
            <p class="mt-2 text-xs">Прочитано файлов: {{ audit.sitemap.files.length }} · URL: {{ audit.sitemap.pages.length }} · Повторов URL: {{ audit.sitemap.duplicates }}</p>
            <p class="mt-1 text-xs">Текущий URL: {{ audit.sitemap.containsCurrent ? 'найден' : audit.sitemap.complete ? 'не найден в обработанных картах' : 'результат неизвестен' }}</p>
            <p v-if="!audit.sitemap.pending && audit.sitemap.discoveryKnown === false" class="mt-2 text-xs text-ui-warning">Список карт может быть неполным из-за ответа robots.txt.</p>
        </template>
        <SitemapDuplicates :items="audit.sitemap.duplicateUrls" />
        <ul v-if="sitemapRows.length > 1 || (audit.sitemap.pending && sitemapRows.length)" class="mt-3 grid gap-2 text-xs">
            <li v-for="(row, index) in sitemapRows" :key="row.href || index" class="grid gap-1 wrap-anywhere rounded-control bg-ui-raised/50 px-2 py-1.5">
                <a v-if="row.href" :href="row.href" target="_blank" rel="noreferrer" class="text-ui-accent">{{ row.href }}</a>
                <span v-else>{{ row.url }}</span>
                <p class="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-ui-muted">
                    <span :class="row.tone === 'success' ? 'text-ui-success' : 'text-ui-warning'">{{ row.label }}</span>
                    <span v-if="row.status" class="font-mono">HTTP {{ row.status }}</span>
                    <span v-if="row.detail">{{ row.detail }}</span>
                </p>
            </li>
        </ul>
    </SeoAuditFileCard>
    <SeoAuditFileCard title="robots.txt" :file="robotsCard">
        <div v-if="robotsCard.tone === 'success'" class="mt-3 text-xs">
            <div class="flex items-center gap-1"><h4 class="font-semibold">Правила для текущего пути</h4><SeoAuditInfo label="Пояснение правил robots.txt" text="Показаны правила исходного сайта для текущего пути. Списки исключений действуют только в аудите." /></div>
            <section v-for="group in robots" :key="group.agent" class="mt-2 grid gap-1.5">
                <h5 class="font-semibold" :class="group.allowed ? 'text-ui-success' : 'text-ui-danger'">{{ group.agent }} — {{ group.allowed ? 'обход разрешён' : 'обход запрещён' }}</h5>
                <p v-if="!group.rules.length" class="text-ui-muted">Подходящих ограничений не найдено</p>
                <div v-for="(rule, index) in group.rules" :key="index" class="grid gap-1 rounded-control bg-ui-field/40 px-2 py-1.5"><span class="break-all">{{ rule.directive.toUpperCase() }}: {{ rule.value }}</span><span class="text-[11px] text-ui-muted">{{ index === 0 ? 'Определяет результат' : 'Перекрыто правилом выше' }}</span></div>
            </section>
        </div>
    </SeoAuditFileCard>
</template>

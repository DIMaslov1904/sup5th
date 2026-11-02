<script setup>
import { computed } from 'vue'
import { ISSUE_CATEGORIES, ISSUE_SEVERITIES, ISSUE_STATUS_LABELS as statusLabels, ISSUE_COLORS as colors, ISSUE_SEVERITY_LABELS as severityLabels, ISSUE_SCOPE_LABELS } from '../utils/seoAuditIssues.js'
import { auditIssuesCsv } from '../utils/seoAuditExport.js'
import { downloadText } from '../utils/seoClient.js'
import Card from '../popup/components/ui/Card.vue'
import Select from '../popup/components/ui/Select.vue'
import Button from '../popup/components/ui/Button.vue'
import SeoAuditInfo from './SeoAuditInfo.vue'

const props = defineProps({ issues: { type: Array, default: () => [] } })
const emit = defineEmits(['select'])
const filter = defineModel('filter', { type: String, default: 'problems' })
const symbols = { pass: '✓', fail: '✕', warning: '!', unknown: '?', na: '—' }
const severityClasses = { critical: 'text-ui-danger', warning: 'text-ui-warning', info: 'text-ui-muted' }
const categoryLabels = Object.fromEntries(ISSUE_CATEGORIES)

const counts = computed(() => ({
    problems: props.issues.filter(issue => ['fail', 'warning', 'unknown'].includes(issue.status)).length,
    fail: props.issues.filter(issue => issue.status === 'fail').length,
    warning: props.issues.filter(issue => issue.status === 'warning').length,
    unknown: props.issues.filter(issue => issue.status === 'unknown').length,
    pass: props.issues.filter(issue => issue.status === 'pass').length,
    na: props.issues.filter(issue => issue.status === 'na').length,
    all: props.issues.length
}))
const filterOptions = computed(() => [
    ['problems', `Проблемы и неопределённые · ${counts.value.problems}`],
    ['all', `Все проверки · ${counts.value.all}`],
    ['fail', `Только ошибки · ${counts.value.fail}`],
    ['warning', `Только рекомендации · ${counts.value.warning}`],
    ['unknown', `Не удалось подтвердить · ${counts.value.unknown}`],
    ['pass', `Успешные · ${counts.value.pass}`],
    ['na', `Не применимо · ${counts.value.na}`]
])
const matched = issue => filter.value === 'problems'
    ? ['fail', 'warning', 'unknown'].includes(issue.status)
    : filter.value === 'all' || issue.status === filter.value
const filtered = computed(() => props.issues.filter(matched))
const groups = computed(() => ISSUE_SEVERITIES
    .map(([id, label]) => ({ id, label, items: filtered.value.filter(issue => issue.severity === id) }))
    .filter(group => group.items.length))
const helpText = issue => [issue.help?.why, issue.help?.how ? `Что делать: ${issue.help.how}` : '',
    `${categoryLabels[issue.category]} · ${statusLabels[issue.status]} · ${ISSUE_SCOPE_LABELS[issue.scope]}`].filter(Boolean).join('\n\n')
const exportCsv = () => downloadText(auditIssuesCsv(filtered.value), 'seo-audit-issues.csv', 'text/csv;charset=utf-8')
</script>
<template>
    <Card title="Проблемы сайта">
        <div class="mb-3 flex flex-wrap items-end justify-between gap-2">
            <label class="grid min-w-0 gap-1 text-xs text-ui-muted">Показать<Select v-model="filter" aria-label="Фильтр проблем аудита" class="max-w-full sm:w-72"><option v-for="[value, label] in filterOptions" :key="value" :value="value">{{ label }}</option></Select></label>
            <Button variant="secondary" size="sm" :disabled="!filtered.length" @click="exportCsv">Скачать CSV ({{ filtered.length }})</Button>
        </div>
        <p v-if="!groups.length" class="text-xs text-ui-muted">Проблем с выбранным статусом нет.</p>
        <section v-for="group in groups" :key="group.id" class="mt-4 first:mt-0">
            <h3 class="mb-2 flex flex-wrap justify-between gap-2 text-xs font-semibold">{{ group.label }}<span class="font-normal text-ui-muted">{{ group.items.length }}</span></h3>
            <ul class="grid min-w-0 gap-1.5">
                <li v-for="issue in group.items" :key="issue.id" :data-audit-issue="issue.id" class="relative grid min-w-0 gap-1.5 rounded-control border border-ui-border bg-ui-field/40 py-2 pr-10 pl-3 text-xs">
                    <SeoAuditInfo :text="helpText(issue)" :label="`Пояснение: ${issue.label}`" class="absolute top-1.5 right-1.5" />
                    <div class="flex flex-wrap items-start justify-between gap-2">
                        <div class="flex min-w-0 items-start gap-2">
                            <span :class="colors[issue.status]" :aria-label="statusLabels[issue.status]" class="shrink-0">{{ symbols[issue.status] }}</span>
                            <span class="min-w-0">
                                <button v-if="issue.urlCount" type="button" class="text-left font-medium text-ui-accent wrap-anywhere hover:underline" @click="emit('select', issue)">{{ issue.label }}</button>
                                <span v-else class="font-medium wrap-anywhere">{{ issue.label }}</span>
                                <span class="ml-2 shrink-0 text-[11px]" :class="severityClasses[issue.severity]">{{ severityLabels[issue.severity] }}</span>
                            </span>
                        </div>
                        <button v-if="issue.urlCount" type="button" class="ui-link shrink-0 text-[11px]" @click="emit('select', issue)">Адреса: {{ issue.urlCount }} →</button>
                        <span v-else class="shrink-0 text-[11px] text-ui-muted">Без адресов</span>
                    </div>
                    <p v-if="issue.hint" class="min-w-0 text-[11px] text-ui-muted wrap-anywhere">{{ issue.hint }}</p>
                </li>
            </ul>
        </section>
    </Card>
</template>

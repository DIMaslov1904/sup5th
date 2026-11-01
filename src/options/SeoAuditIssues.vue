<script setup>
import { computed, ref } from 'vue'
import { ISSUE_CATEGORIES } from '../utils/seoAuditIssues.js'
import Card from '../popup/components/ui/Card.vue'
import Select from '../popup/components/ui/Select.vue'

const props = defineProps({ issues: { type: Array, default: () => [] } })
const emit = defineEmits(['select'])
const filter = ref('problems')
const statusLabels = { pass: 'Подтверждено', fail: 'Ошибка', warning: 'Рекомендация', unknown: 'Неизвестно', na: 'Не применимо' }
const colors = { pass: 'text-ui-success', fail: 'text-ui-danger', warning: 'text-ui-warning', unknown: 'text-ui-muted', na: 'text-ui-muted' }
const symbols = { pass: '✓', fail: '✕', warning: '!', unknown: '?', na: '—' }
const severityLabels = { critical: 'критично', warning: 'важно', info: 'инфо' }
const severityClasses = { critical: 'text-ui-danger', warning: 'text-ui-warning', info: 'text-ui-muted' }

const counts = computed(() => ({
    problems: props.issues.filter(issue => ['fail', 'warning', 'unknown'].includes(issue.status)).length,
    fail: props.issues.filter(issue => issue.status === 'fail').length,
    warning: props.issues.filter(issue => issue.status === 'warning').length,
    unknown: props.issues.filter(issue => issue.status === 'unknown').length,
    pass: props.issues.filter(issue => issue.status === 'pass').length,
    all: props.issues.length
}))
const filterOptions = computed(() => [
    ['problems', `Ошибки и рекомендации · ${counts.value.problems}`],
    ['all', `Все проверки · ${counts.value.all}`],
    ['fail', `Только ошибки · ${counts.value.fail}`],
    ['warning', `Только рекомендации · ${counts.value.warning}`],
    ['unknown', `Не удалось подтвердить · ${counts.value.unknown}`],
    ['pass', `Успешные · ${counts.value.pass}`]
])
const matched = issue => filter.value === 'problems'
    ? ['fail', 'warning', 'unknown'].includes(issue.status)
    : filter.value === 'all' || issue.status === filter.value
const groups = computed(() => ISSUE_CATEGORIES
    .map(([id, label]) => ({ id, label, items: props.issues.filter(issue => issue.category === id && matched(issue)) }))
    .filter(group => group.items.length))
const hasHelp = issue => Boolean(issue.help?.how || (issue.help?.why && issue.help.why !== issue.hint))
</script>
<template>
    <Card title="Проблемы сайта">
        <label class="mb-3 flex flex-wrap items-center gap-2 text-xs text-ui-muted">Показать<Select v-model="filter" aria-label="Фильтр проблем аудита" class="w-72"><option v-for="[value, label] in filterOptions" :key="value" :value="value">{{ label }}</option></Select></label>
        <p v-if="!groups.length" class="text-xs text-ui-muted">Проблем с выбранным статусом нет.</p>
        <section v-for="group in groups" :key="group.id" class="mt-4 first:mt-0">
            <h3 class="mb-2 flex flex-wrap justify-between gap-2 text-xs font-semibold">{{ group.label }}<span class="font-normal text-ui-muted">{{ group.items.length }}</span></h3>
            <ul class="grid min-w-0 gap-1.5">
                <li v-for="issue in group.items" :key="issue.id" class="grid min-w-0 gap-1.5 rounded-control border border-ui-border bg-ui-field/40 px-3 py-2 text-xs">
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
                    <details v-if="hasHelp(issue)" class="text-[11px]">
                        <summary class="cursor-pointer text-ui-accent">Пояснение</summary>
                        <p v-if="issue.help?.why" class="mt-1 text-ui-muted">{{ issue.help.why }}</p>
                        <p v-if="issue.help?.how" class="mt-1"><span class="text-ui-muted">Что делать: </span>{{ issue.help.how }}</p>
                    </details>
                </li>
            </ul>
        </section>
    </Card>
</template>

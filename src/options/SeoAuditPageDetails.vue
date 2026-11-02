<script setup>
import { computed } from 'vue'
import { evaluateHttpStatus } from '../utils/seoValidation.js'
import { indexingRulesFromMeta } from '../utils/seoRules.js'
import { ISSUE_COLORS, ISSUE_STATUS_LABELS, ISSUE_SCOPE_LABELS } from '../utils/seoAuditIssues.js'
import Button from '../popup/components/ui/Button.vue'
import Card from '../popup/components/ui/Card.vue'
import PropertyList from '../popup/components/ui/PropertyList.vue'
import SeoAuditSources from './SeoAuditSources.vue'
const props = defineProps({ page: { type: Object, required: true } })
const emit = defineEmits(['back', 'select-issue'])
const complete = computed(() => props.page.metaState === 'complete')
const headers = computed(() => props.page.response?.xRobotsTags || props.page.response?.headers?.['x-robots-tag'] || '')
const indexing = computed(() => indexingRulesFromMeta(props.page.indexingMeta || [], headers.value))
const metaRows = computed(() => [
    { label: 'Title', value: complete.value ? props.page.title || 'Не заполнен' : 'Не удалось подтвердить' },
    { label: 'Description', value: complete.value ? props.page.description || 'Не заполнен' : 'Не удалось подтвердить' },
    { label: 'H1', value: complete.value ? props.page.h1s?.map((text, i) => `${i + 1}. ${text || '(пустой)'}`).join('\n') || 'Не найден' : 'Не удалось подтвердить' },
    { label: 'Meta robots', value: complete.value ? indexing.value.robots || 'Не задан' : 'Не удалось подтвердить' },
    { label: 'X-Robots-Tag', value: Array.isArray(headers.value) ? headers.value.join('; ') : headers.value || (props.page.status ? 'Не задан' : 'Не удалось подтвердить') }
])
const http = computed(() => evaluateHttpStatus(props.page.status, props.page.redirected))
</script>
<template>
    <div class="grid min-w-0 gap-3" data-audit-page-details>
        <nav class="flex min-w-0 flex-wrap items-center gap-2 text-xs" aria-label="Карточка страницы">
            <Button variant="ghost" size="sm" @click="emit('back')">← К страницам</Button><span class="text-ui-muted">Страницы /</span><span class="min-w-0 wrap-anywhere">{{ page.url }}</span>
        </nav>
        <Card title="Карточка страницы">
            <a :href="page.url" target="_blank" rel="noreferrer" class="block wrap-anywhere text-xs text-ui-accent">{{ page.url }}</a>
            <a v-if="page.redirected" :href="page.finalUrl" target="_blank" rel="noreferrer" class="mt-1 block wrap-anywhere text-xs text-ui-accent">Конечный URL: {{ page.finalUrl }}</a>
            <p class="mt-2 text-xs" :class="http.status === 'danger' ? 'text-ui-danger' : http.status === 'success' ? 'text-ui-success' : 'text-ui-warning'">{{ page.label || `HTTP ${page.status || 'не получен'}` }} · {{ http.hint }}</p>
            <p v-if="!complete" class="mt-2 text-xs text-ui-warning">{{ page.metaReason || 'Полный HTML не получен. Метаданные и H1 не проверены.' }}</p>
            <div class="mt-3 whitespace-pre-line"><PropertyList :items="metaRows" /></div>
            <div class="mt-3 grid gap-1 text-xs">
                <p v-for="item in indexing.indexingAgents" :key="item.agent" :class="complete && item.allowed === false ? 'text-ui-danger' : 'text-ui-muted'">{{ item.agent }}: {{ !complete || item.allowed === null ? 'индексацию не удалось подтвердить' : item.allowed ? 'в полученных meta и HTTP-заголовках нет noindex' : 'индексация запрещена через noindex' }}</p>
                <p class="text-[11px] text-ui-muted">Эти директивы описывают полученный ответ. Наличие страницы в поисковом индексе не проверялось.</p>
            </div>
            <h4 class="mb-1 mt-3 text-xs font-semibold">Источник ссылки</h4>
            <SeoAuditSources :sources="page.sources" :sitemaps="page.sitemaps" :current="page.current" />
        </Card>
        <Card :title="`Ошибки и рекомендации · ${page.problemCount}`">
            <p v-if="!page.issues.length" class="text-xs text-ui-muted">{{ complete ? 'В выполненных проверках для этого URL проблем не найдено.' : 'Недостаточно данных для проверки метаданных этой страницы.' }}</p>
            <ul v-else class="grid gap-2 text-xs">
                <li v-for="issue in page.issues" :key="issue.id" class="grid gap-1 rounded-control border border-ui-border p-3">
                    <button type="button" class="text-left text-ui-accent hover:underline" @click="emit('select-issue', issue)">{{ issue.label }} →</button>
                    <p :class="ISSUE_COLORS[issue.status]">{{ ISSUE_STATUS_LABELS[issue.status] }} · {{ ISSUE_SCOPE_LABELS[issue.scope] }}</p>
                    <p class="text-ui-muted">{{ issue.hint }}</p>
                    <p v-if="issue.help?.why" class="text-ui-muted">{{ issue.help.why }}</p>
                    <p v-if="issue.help?.how">Что делать: {{ issue.help.how }}</p>
                </li>
            </ul>
        </Card>
    </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import Card from '../popup/components/ui/Card.vue'
import Select from '../popup/components/ui/Select.vue'
const props = defineProps({ checks: { type: Array, default: () => [] } })
const filter = ref('all')
const labels = { pass: 'Подтверждено', fail: 'Ошибка', warning: 'Рекомендация', unknown: 'Неизвестно', na: 'Не применимо' }
const colors = { pass: 'text-ui-success', fail: 'text-ui-danger', warning: 'text-ui-warning', unknown: 'text-ui-muted', na: 'text-ui-muted' }
const symbols = { pass: '✓', fail: '✕', warning: '!', unknown: '?', na: '—' }
const definitions = [
    { label: 'Ответы сервера и ссылки', match: id => ['http', 'redirect', 'representation', 'ssl'].includes(id) || id.startsWith('links-') },
    { label: 'Мета-теги', match: id => /^(?:title|description|duplicates-|canonical|charset|twitter)/.test(id) },
    { label: 'Контент и изображения', match: id => ['h1', 'images-alt', 'lang', 'viewport', 'favicon'].includes(id) },
    { label: 'Индексация', match: id => /^(?:index-|crawl-)/.test(id) },
    { label: 'Sitemap', match: id => id.startsWith('sitemap') || id === 'llm-txt' },
    { label: 'Core Web Vitals', match: id => /^(?:cwv|cwv-)/.test(id) }
]
const groups = computed(() => definitions.map(group => {
    const all = props.checks.filter(item => group.match(item.id))
    const items = all.filter(item => filter.value === 'all' || (filter.value === 'issues' ? ['fail', 'warning'].includes(item.status) : item.status === filter.value))
    return { ...group, items, issues: all.filter(item => ['fail', 'warning'].includes(item.status)).length, total: all.length }
}).filter(group => group.items.length))
</script>
<template>
    <Card title="Проверки по разделам">
        <label class="mb-3 flex flex-wrap items-center gap-2 text-xs text-ui-muted">Показать<Select v-model="filter" aria-label="Статус SEO-проверок" class="w-60"><option value="all">Все проверки</option><option value="issues">Ошибки и рекомендации</option><option value="fail">Только ошибки</option><option value="unknown">Не удалось подтвердить</option><option value="pass">Успешные</option></Select></label>
        <p v-if="!groups.length" class="text-xs text-ui-muted">Проверок с выбранным статусом нет.</p>
        <section v-for="group in groups" :key="group.label" class="mt-4 first:mt-0">
            <h4 class="mb-2 flex flex-wrap justify-between gap-2 text-xs font-semibold">{{ group.label }}<span class="font-normal text-ui-muted">С проблемами: {{ group.issues }} из {{ group.total }}</span></h4>
            <ul class="grid min-w-0 gap-1.5">
                <li v-for="item in group.items" :key="item.id" :data-check="item.id" :data-status="item.status" class="grid min-w-0 gap-1 rounded-control border border-ui-border bg-ui-field/40 px-3 py-2 text-xs sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:gap-3">
                    <span class="flex min-w-0 items-start gap-2"><span :class="colors[item.status]" :aria-label="labels[item.status]" class="shrink-0">{{ symbols[item.status] }}</span><span class="min-w-0 wrap-anywhere">{{ item.label }}</span></span>
                    <span v-if="item.hint" class="min-w-0 wrap-anywhere text-[11px] text-ui-muted">{{ item.hint }}</span>
                </li>
            </ul>
        </section>
    </Card>
</template>

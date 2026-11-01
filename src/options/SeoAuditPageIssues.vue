<script setup>
import { computed, ref } from 'vue'
import { summarizeAuditPages, uniqueAuditPages } from '../utils/seoAuditPages.js'
import Card from '../popup/components/ui/Card.vue'
import Button from '../popup/components/ui/Button.vue'
const props = defineProps({ results: { type: Array, default: () => [] } })
const open = ref(new Set()), limits = ref({}), groupLimit = ref(25)
const html = computed(() => uniqueAuditPages(props.results))
const summary = computed(() => summarizeAuditPages(props.results))
const groups = computed(() => [
    { id: 'missing-title', label: 'Не заполнен Title', urls: html.value.filter(item => !item.title).map(item => item.finalUrl) },
    { id: 'missing-description', label: 'Не заполнен Description', urls: html.value.filter(item => !item.description).map(item => item.finalUrl) },
    { id: 'h1', label: 'H1 отсутствует, пустой или встречается несколько раз', urls: html.value.filter(item => item.h1s?.length !== 1 || !item.h1s?.[0]?.trim()).map(item => item.finalUrl) },
    ...summary.value.duplicateTitles.map((group, i) => ({ ...group, id: `title-${i}`, label: `Совпадение Title: ${group.value}` })),
    ...summary.value.duplicateDescriptions.map((group, i) => ({ ...group, id: `description-${i}`, label: `Совпадение Description: ${group.value}` }))
].filter(group => group.urls.length))
const toggle = (id, event) => { if (event.target.open) open.value.add(id); else open.value.delete(id) }
</script>
<template>
    <Card v-if="html.length" title="Мета-теги и H1 на проверенных страницах">
        <p class="mb-2 text-xs text-ui-muted">Проверено полных HTML: {{ html.length }}. Здесь анализируем HTTP-ответы внутренних страниц; DOM открытой страницы проверяется отдельно.</p>
        <p v-if="!groups.length" class="text-xs text-ui-success">Пустых Title/Description, проблем с H1 и совпадений метатегов в полученных HTML не найдено.</p>
        <details v-for="group in groups.slice(0, groupLimit)" :key="group.id" class="mt-2 text-xs" @toggle="toggle(group.id, $event)">
            <summary class="cursor-pointer wrap-anywhere text-ui-warning">{{ group.label }} — {{ group.urls.length }} URL</summary>
            <div v-if="open.has(group.id)" class="mt-2 grid gap-1">
                <a v-for="url in group.urls.slice(0, limits[group.id] || 25)" :key="url" :href="url" target="_blank" rel="noreferrer" class="break-all text-ui-accent">{{ url }}</a>
                <Button v-if="group.urls.length > (limits[group.id] || 25)" variant="secondary" size="sm" class="mt-1 justify-self-start" @click="limits[group.id] = (limits[group.id] || 25) + 25">Ещё 25 URL</Button>
            </div>
        </details>
        <Button v-if="groups.length > groupLimit" variant="secondary" size="sm" class="mt-3" @click="groupLimit += 25">Ещё группы ({{ groups.length - groupLimit }})</Button>
    </Card>
</template>

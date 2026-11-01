<script setup>
import { computed, ref, watch } from 'vue'
const props = defineProps({ sources: { type: Array, default: () => [] }, sitemaps: { type: Array, default: () => [] }, current: Boolean })
const open = ref(false), page = ref(1)
const count = computed(() => Math.max(1, Math.ceil((props.sources.length - 1) / 10)))
const additional = computed(() => props.sources.slice(1 + (page.value - 1) * 10, 1 + page.value * 10))
watch(() => props.sources[0], () => { page.value = 1; open.value = false })
</script>
<template>
    <div class="grid min-w-0 gap-1 text-[11px]">
        <a v-if="sources.length" :href="sources[0]" :title="sources[0]" target="_blank" rel="noreferrer" class="block truncate text-ui-accent">{{ sources[0] }}</a>
        <span v-else class="text-ui-muted">{{ current ? 'Исходная страница аудита' : sitemaps.length ? 'Найдено в sitemap; ссылка со страницы не встречена' : 'Страница-источник не найдена' }}</span>
        <details v-if="sources.length > 1" @toggle="open = $event.target.open">
            <summary class="cursor-pointer text-ui-muted">Ещё страниц: {{ sources.length - 1 }}</summary>
            <div v-if="open" class="mt-1 grid gap-1">
                <a v-for="url in additional" :key="url" :href="url" :title="url" target="_blank" rel="noreferrer" class="block truncate text-ui-accent">{{ url }}</a>
                <div v-if="count > 1" class="flex flex-wrap items-center gap-2">
                    <button type="button" class="ui-link disabled:opacity-45" :disabled="page === 1" aria-label="Предыдущие страницы-источники" @click="page--">Назад</button>
                    <span>{{ page }} / {{ count }}</span>
                    <button type="button" class="ui-link disabled:opacity-45" :disabled="page >= count" aria-label="Следующие страницы-источники" @click="page++">Далее</button>
                </div>
            </div>
        </details>
        <details v-if="sitemaps.length">
            <summary class="cursor-pointer text-ui-muted">Sitemap: {{ sitemaps.length }}</summary>
            <a v-for="url in sitemaps" :key="url" :href="url" :title="url" target="_blank" rel="noreferrer" class="mt-1 block truncate text-ui-accent">{{ url }}</a>
        </details>
    </div>
</template>

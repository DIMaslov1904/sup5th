<script setup>
import { ref, watch } from 'vue'
import Button from '../popup/components/ui/Button.vue'
const props = defineProps({ items: { type: Array, default: () => [] } })
const visible = ref(50)
watch(() => props.items.length, length => { if (!length) visible.value = 50 })
</script>
<template>
    <div v-if="items.length" class="mt-3 min-w-0 text-xs">
        <h3 class="font-semibold">Повторяющиеся URL ({{ items.length }})</h3>
        <ul class="mt-2 grid max-h-80 min-w-0 gap-2 overflow-y-auto pr-1">
            <li v-for="item in items.slice(0,visible)" :key="item.url" class="min-w-0 rounded-control border border-ui-border bg-ui-field/40 px-3 py-2">
                <a :href="item.url" target="_blank" rel="noreferrer" class="break-all text-ui-accent">{{ item.url }}</a>
                <p class="mt-1 text-ui-warning">Вхождений: {{ item.count }}</p>
                <details class="mt-1 text-ui-muted"><summary class="cursor-pointer">Файлы sitemap ({{ item.sources.length }})</summary><a v-for="source in item.sources" :key="source" :href="source" target="_blank" rel="noreferrer" class="mt-1 block break-all text-ui-accent">{{ source }}</a></details>
            </li>
        </ul>
        <Button v-if="items.length > visible" class="mt-2" variant="secondary" size="sm" @click="visible += 50">Показать ещё ({{ items.length - visible }})</Button>
    </div>
</template>

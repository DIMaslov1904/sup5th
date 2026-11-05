<script setup>
import { computed } from 'vue'
import Card from './ui/Card.vue'
import PropertyList from './ui/PropertyList.vue'

const props = defineProps({ analytics: { type: Array, default: () => [] }, source: String })
const rows = computed(() => props.analytics.map(({ name, ids }) => {
    const value = ids.join(', ')
    return value ? { label: name, value, copyValue: value } : { label: name, value: 'ID не определён' }
}))
</script>

<template>
    <Card v-if="rows.length" title="Счётчики и пиксели">
        <PropertyList :items="rows" />
        <p class="mt-3 text-xs text-ui-muted">{{ source === 'html' ? 'Найдены в коде исходной страницы.' : 'Найдены в коде или загруженных ресурсах исходной страницы.' }}</p>
    </Card>
</template>

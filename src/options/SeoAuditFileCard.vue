<script setup>
import { computed } from 'vue'
import { normalizeAuditUrl } from '../utils/seoAuditLinks.js'
import Card from '../popup/components/ui/Card.vue'

const props = defineProps({ title: String, file: { type: Object, required: true } })
const href = computed(() => normalizeAuditUrl(props.file.url))
const colors = {
    success: 'bg-ui-success/12 text-ui-success',
    warning: 'bg-ui-warning/12 text-ui-warning',
    danger: 'bg-ui-danger/12 text-ui-danger',
    muted: 'bg-ui-raised text-ui-muted'
}
</script>
<template>
    <Card :title="title">
        <div class="flex flex-wrap items-center gap-2 text-xs">
            <span :class="colors[file.tone]" class="rounded-control px-2 py-1 font-medium">{{ file.label }}</span>
            <span v-if="file.status" class="font-mono text-ui-muted">HTTP {{ file.status }}</span>
        </div>
        <a v-if="href" :href="href" target="_blank" rel="noreferrer" class="mt-2 block wrap-anywhere text-xs text-ui-accent">{{ href }}</a>
        <p v-else-if="file.url" class="mt-2 wrap-anywhere text-xs text-ui-muted">{{ file.url }}</p>
        <p v-if="file.detail" class="mt-2 text-xs text-ui-muted">{{ file.detail }}</p>
        <slot />
    </Card>
</template>

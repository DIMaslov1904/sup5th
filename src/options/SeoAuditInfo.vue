<script setup>
import HoverHint from '../popup/components/ui/HoverHint.vue'
defineProps({ text: { type: String, required: true }, label: { type: String, default: 'Пояснение' } })
</script>
<template>
    <HoverHint :text="text" :aria-label="label" class="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-ui-muted hover:bg-ui-raised hover:text-ui-accent focus-visible:outline-2 focus-visible:outline-ui-accent">
        <svg class="size-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><circle cx="10" cy="10" r="7.5" /><path d="M10 9v5" /><circle cx="10" cy="6.5" r=".65" fill="currentColor" stroke="none" /></svg>
    </HoverHint>
</template>

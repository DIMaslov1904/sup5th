<script setup>
import { computed } from 'vue'
const props = defineProps({ label: String })
// Local category icons; no third-party favicon requests when opening this tab.
const path = computed(() => {
    if (props.label === 'PageSpeed Insights') return 'M4 18a9 9 0 1 1 16 0M12 13l5-5M7 18h10'
    if (props.label?.includes('Валидатор')) return 'm8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 16'
    if (props.label === 'Schema.org' || props.label === 'Google Rich Results') return 'M7 3H4v18h3M17 3h3v18h-3M9 8h6M9 12h6M9 16h3'
    if (props.label === 'SSL') return 'm12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6'
    if (props.label === 'Webarchive') return 'M3 12a9 9 0 1 0 3-7M3 3v5h5m4-1v5l3 2'
    if (props.label === 'WHOIS') return 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3a18 18 0 0 1 0 18 18 18 0 0 1 0-18Z'
    return 'M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Zm-2 5 6 6'
})
</script>
<template>
    <span aria-hidden="true" class="flex size-9 shrink-0 items-center justify-center rounded-control border border-ui-accent/20 bg-ui-accent/8 text-ui-accent">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" class="size-5"><path :d="path" /></svg>
    </span>
</template>

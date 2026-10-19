<script setup>
defineProps({ title: { type: String, required: true } })
</script>

<template>
    <details class="group rounded-panel border border-ui-border bg-ui-panel open:border-ui-accent/40">
        <summary class="flex cursor-pointer list-none items-center justify-between gap-4 rounded-panel px-4 py-3 font-medium hover:bg-ui-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-accent [&::-webkit-details-marker]:hidden">
            {{ title }}
            <svg class="size-4 shrink-0 text-ui-muted group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
        </summary>
        <div class="grid gap-3 border-t border-ui-border px-4 py-4 text-ui-muted"><slot /></div>
    </details>
</template>

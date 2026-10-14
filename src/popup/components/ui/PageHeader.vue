<script setup>
defineProps({
    title: { type: String, default: '' },
    subtitle: { type: String, default: '' }
})
</script>

<template>
    <header class="flex items-center justify-between gap-3">
        <div class="min-w-0">
            <h1 class="ui-title">{{ title }}</h1>
            <p v-if="subtitle" class="text-xs text-ui-muted">{{ subtitle }}</p>
        </div>
        <div v-if="$slots.actions" class="flex shrink-0 items-center gap-2">
            <slot name="actions" />
        </div>
    </header>
</template>

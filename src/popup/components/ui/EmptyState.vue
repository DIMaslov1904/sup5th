<script setup>
defineProps({ title: String, description: String })
</script>
<template>
    <div class="ui-panel grid gap-2 border-dashed py-5 text-center m-auto" role="status">
        <svg class="mx-auto size-6 text-ui-muted/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5 M12 7v.1" /></svg>
        <p class="text-[13px] font-medium text-ui-muted">{{ title }}</p>
        <p v-if="description" class="text-xs text-ui-muted/70">{{ description }}</p>
        <slot />
    </div>
</template>

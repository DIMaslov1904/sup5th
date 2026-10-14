<script setup>
defineProps({
    title: { type: String, default: '' }
})
</script>

<template>
    <section class="ui-panel">
        <h3 v-if="title" class="mb-3 text-[13px] font-semibold text-ui-text">{{ title }}</h3>
        <slot />
    </section>
</template>

<script setup>
defineProps({
    title: { type: String, default: '' }
})
</script>

<template>
    <section class="rounded-lg border border-white/10 bg-slate-900/40 p-3">
        <h3 v-if="title" class="mb-2 text-sm font-semibold">{{ title }}</h3>
        <slot />
    </section>
</template>

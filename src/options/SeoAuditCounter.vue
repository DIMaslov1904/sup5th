<script setup>
defineProps({
    label: { type: String, required: true },
    count: { type: Number, required: true },
    pressed: { type: Boolean, default: undefined }
})
</script>
<template>
    <button type="button" :aria-pressed="pressed" :class="{ 'ring-1 ring-current ring-inset': pressed }"
        class="flex min-w-0 cursor-pointer flex-col items-start justify-between gap-0.5 rounded-control border border-ui-border/60 border-s-2 border-s-current bg-ui-raised/50 px-3 py-2 text-left hover:bg-ui-raised">
        <span class="text-xs font-medium wrap-anywhere">{{ label }}</span>
        <span class="text-xl leading-tight font-semibold tabular-nums">{{ count }}</span>
    </button>
</template>

<script setup>
defineProps({
    modelValue: Boolean,
    label: { type: String, required: true },
    disabled: Boolean,
    describedBy: String
})
defineEmits(['update:modelValue'])
</script>
<template>
    <label class="flex cursor-pointer items-center justify-between gap-3 text-[13px]">
        <span>{{ label }}</span>
        <input type="checkbox" role="switch" :aria-label="label" :aria-describedby="describedBy" :checked="modelValue" :disabled="disabled" class="peer sr-only" @change="$emit('update:modelValue', $event.target.checked)" />
        <span aria-hidden="true" class="relative h-5 w-9 shrink-0 rounded-full bg-ui-border transition-colors after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-ui-accent peer-checked:after:translate-x-4 peer-focus-visible:outline-2 peer-focus-visible:outline-ui-accent peer-disabled:opacity-50"></span>
    </label>
</template>

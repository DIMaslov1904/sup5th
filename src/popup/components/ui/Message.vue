<script setup>
defineProps({
    type: { type: String, default: 'error' } // error | info | success
})
</script>

<template>
    <p v-if="$slots.default" class="mt-3 rounded p-2 text-xs text-white"
        :class="{
            'bg-[#c1a100cc]': type === 'error',
            'bg-slate-800 text-slate-200': type === 'info',
            'bg-emerald-700': type === 'success'
        }">
        <slot />
    </p>
</template>

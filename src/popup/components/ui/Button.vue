<script setup>
import { computed } from 'vue'

const props = defineProps({
    variant: { type: String, default: 'primary' }, // primary | secondary | ghost | danger
    size: { type: String, default: 'md' },         // sm | md
    href: { type: String, default: '' },
    disabled: { type: Boolean, default: false }
})

const classes = computed(() => {
    const base = 'inline-flex items-center justify-center gap-1.5 rounded font-medium transition cursor-pointer disabled:pointer-events-none disabled:opacity-50 select-none'
    const sizes = { sm: 'px-2.5 py-1.5 text-xs', md: 'px-3 py-2 text-sm' }
    const variants = {
        primary: 'bg-sky-700 text-white hover:bg-sky-600',
        secondary: 'bg-slate-800 text-white hover:bg-slate-700 border border-white/10',
        ghost: 'border border-white/10 text-slate-200 hover:bg-white/10',
        danger: 'border border-red-400/40 text-red-300 hover:bg-red-400/10'
    }
    return `${base} ${sizes[props.size]} ${variants[props.variant]}`
})
</script>

<template>
    <component :is="href ? 'a' : 'button'" :href="href || undefined" target="_blank" rel="noreferrer"
        :type="href ? undefined : 'button'" :disabled="!href && disabled" :class="classes">
        <slot />
    </component>
</template>

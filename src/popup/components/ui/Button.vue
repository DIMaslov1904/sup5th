<script setup>
import { computed } from 'vue'

const props = defineProps({
    variant: { type: String, default: 'primary' }, // primary | secondary | ghost | danger
    size: { type: String, default: 'md' },         // sm | md
    href: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
    loading: { type: Boolean, default: false },
    type: { type: String, default: 'button' },
    target: { type: String, default: '_blank' }
})

const classes = computed(() => {
    const variant = ['primary', 'secondary', 'ghost', 'danger'].includes(props.variant) ? props.variant : 'primary'
    return ['ui-button', `ui-button--${variant}`, props.size === 'sm' ? 'ui-button--sm' : '']
})
</script>

<template>
    <component :is="href ? 'a' : 'button'" :href="href && !disabled && !loading ? href : undefined" :target="href ? target : undefined" :rel="href ? 'noreferrer' : undefined"
        :type="href ? undefined : type" :disabled="!href && (disabled || loading)" :aria-disabled="href && (disabled || loading) ? true : undefined" :aria-busy="loading || undefined" :tabindex="href && (disabled || loading) ? -1 : undefined" :class="[classes, href && (disabled || loading) ? 'pointer-events-none opacity-45' : '']" @click="event => { if (disabled || loading) { event.preventDefault(); event.stopImmediatePropagation() } }">
        <span v-if="loading" class="ui-loading" aria-hidden="true"></span>
        <slot />
    </component>
</template>

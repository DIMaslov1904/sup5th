<script setup>
import { onUnmounted, ref, watch } from 'vue'
import Button from './Button.vue'
import Notification from './Notification.vue'
const props = defineProps({ value: { default: '' }, action: Function, label: { type: String, default: 'Скопировать' }, compact: Boolean, disabled: Boolean })
const copied = ref(false), copying = ref(false), error = ref('')
let timer, revision = 0, alive = true
watch(() => props.value, () => { revision++; copied.value = false; clearTimeout(timer) })
const copy = async () => {
    if (copying.value || props.disabled) return
    copying.value = true; copied.value = false; error.value = ''; clearTimeout(timer)
    const current = revision
    try {
        if (props.action) await props.action()
        else await navigator.clipboard.writeText(String(props.value ?? ''))
        if (alive && current === revision) { copied.value = true; timer = setTimeout(() => { copied.value = false }, 1800) }
    } catch (reason) { if (alive) error.value = reason.message || 'Не удалось скопировать' }
    finally { if (alive) copying.value = false }
}
onUnmounted(() => { alive = false; clearTimeout(timer) })
</script>
<template>
    <Button size="sm" variant="ghost" :disabled="disabled || copying" :aria-label="label" :title="copied ? 'Скопировано' : label" :class="compact ? 'size-6 border-transparent! p-0!' : ''" @click="copy">
        <span v-if="copied" class="ui-copy-confirm text-ui-success" role="status">✓<span v-if="!compact"> Скопировано</span><span v-else class="sr-only">Скопировано</span></span>
        <svg v-else-if="compact" class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>
        <slot v-else>{{ label }}</slot>
    </Button>
    <Notification v-if="error" :text="error" />
</template>

<script setup>
import HoverHint from './HoverHint.vue'
import CopyButton from './CopyButton.vue'
defineProps({ items: { type: Array, required: true } })
const statusClasses = { success: 'text-ui-success', warning: 'text-ui-warning', danger: 'text-ui-danger' }
</script>

<template>
    <dl class="grid min-w-0 gap-2 text-xs">
        <div v-for="(item, index) in items" :key="`${index}:${item.label}`" class="grid min-w-0 grid-cols-[112px_minmax(0,1fr)] items-start gap-3">
            <dt class="min-w-0 wrap-anywhere text-ui-muted">{{ item.label }}</dt>
            <dd class="flex min-w-0 items-start gap-2 wrap-anywhere text-ui-text">
                <HoverHint class="min-w-0 flex-1" :text="[item.hint, item.warning].filter(Boolean).join(' ')"><span :class="statusClasses[item.status] || (item.warning ? 'text-ui-warning' : '')">{{ String(item.value ?? '') || '(пусто)' }}</span></HoverHint>
                <CopyButton v-if="'copyValue' in item" compact :label="`Скопировать ${item.label}`" :value="item.copyValue" :disabled="!item.copyValue" />
            </dd>
        </div>
    </dl>
</template>

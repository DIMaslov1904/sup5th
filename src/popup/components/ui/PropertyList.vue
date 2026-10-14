<script setup>
defineProps({ items: { type: Array, required: true } })
</script>

<template>
    <dl class="grid min-w-0 gap-2 text-xs">
        <div v-for="(item, index) in items" :key="`${index}:${item.label}`" class="grid min-w-0 grid-cols-[112px_minmax(0,1fr)] items-start gap-3">
            <dt class="min-w-0 wrap-anywhere text-ui-muted/70">{{ item.label }}</dt>
            <dd class="min-w-0 wrap-anywhere text-ui-text">
                {{ String(item.value ?? '') || '(пусто)' }}
                <span v-if="item.warning" class="block text-[11px] text-ui-warning">{{ item.warning }}</span>
            </dd>
        </div>
    </dl>
</template>

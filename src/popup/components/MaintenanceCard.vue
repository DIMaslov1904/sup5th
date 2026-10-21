<script setup>
import Card from './ui/Card.vue'

defineProps({ title: { type: String, required: true } })
</script>

<template>
    <Card>
        <div class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <div class="min-w-0 wrap-anywhere">
                <h3 class="mb-1 text-[13px] font-semibold text-ui-text">{{ title }}</h3>
                <div class="grid gap-2 text-xs text-ui-muted"><slot /></div>
            </div>
            <div class="flex flex-col items-end gap-2"><slot name="actions" /></div>
        </div>
    </Card>
</template>

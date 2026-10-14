<script setup>
defineProps({
    type: { type: String, default: 'error' } // error | info | success
})
</script>

<template>
    <p v-if="$slots.default" :role="type === 'error' ? 'alert' : 'status'" class="ui-message rounded-panel border px-3 py-2 text-xs leading-5"
        :class="{
            'border-ui-danger/30 bg-ui-danger/8 text-ui-danger': type === 'error',
            'border-ui-border bg-ui-raised/60 text-ui-muted': type === 'info',
            'border-ui-success/30 bg-ui-success/8 text-ui-success': type === 'success',
            'border-ui-warning/30 bg-ui-warning/8 text-ui-warning': type === 'warning'
        }">
        <slot />
    </p>
</template>

<script setup>
defineProps({ label: { type: String, required: true }, disabled: Boolean })
</script>
<template>
    <button type="button" :aria-label="label" :title="label" :disabled="disabled" class="ui-icon-button"><slot /></button>
</template>

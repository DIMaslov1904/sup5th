<script setup>
const value = defineModel({ type: [String, Number], default: '' })
defineProps({ disabled: Boolean })
</script>
<template>
    <select v-model="value" :disabled="disabled" class="ui-field ui-select cursor-pointer pr-9"><slot /></select>
</template>

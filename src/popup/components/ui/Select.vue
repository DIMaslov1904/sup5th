<script setup>
const value = defineModel({ type: [String, Number], default: '' })
defineProps({ disabled: Boolean })
</script>
<template>
    <select v-model="value" :disabled="disabled" class="ui-field cursor-pointer pr-7"><slot /></select>
</template>

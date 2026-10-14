<script setup>
defineProps({ label: { type: String, default: 'Загрузка…' } })
</script>
<template><div role="status" class="flex items-center justify-center gap-3 py-8 text-xs text-ui-muted"><span class="ui-loading" aria-hidden="true"></span>{{ label }}</div></template>

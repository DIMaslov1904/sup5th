<script setup>
import { onUnmounted, ref, watch } from 'vue'
const props = defineProps({ text: String })
const visible = ref(false)
let timer
watch(() => props.text, text => { clearTimeout(timer); visible.value = Boolean(text); if (text) timer = setTimeout(() => { visible.value = false }, 1800) }, { immediate: true })
onUnmounted(() => clearTimeout(timer))
</script>
<template><span v-if="visible" role="status" class="ui-copy-confirm text-[11px] text-ui-success">✓ {{ text }}</span></template>

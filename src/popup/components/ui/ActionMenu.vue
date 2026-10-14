<script setup>
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
defineProps({ label: { type: String, required: true } })
const menu = ref(null), panel = ref(null), above = ref(false)
const close = () => { if (menu.value) menu.value.open = false }
const closeOutside = event => { if (menu.value && !menu.value.contains(event.target)) close() }
const place = async () => {
    if (!menu.value?.open) return
    await nextTick()
    const rect = menu.value.getBoundingClientRect(), height = panel.value?.offsetHeight || 0
    above.value = innerHeight - rect.bottom < height + 8 && rect.top > height + 8
}
onMounted(() => document.addEventListener('pointerdown', closeOutside))
onUnmounted(() => document.removeEventListener('pointerdown', closeOutside))
defineExpose({ close })
</script>
<template>
    <details ref="menu" class="relative" @toggle="place" @keydown.esc="close">
        <summary :aria-label="label" :title="label" class="ui-icon-button size-7 list-none text-lg leading-none">⋮</summary>
        <div ref="panel" class="ui-menu absolute right-0 z-20" :class="above ? 'bottom-8' : 'top-8'"><slot /></div>
    </details>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
const props = defineProps({ src: { type: String, required: true }, alt: String })
const anchor = ref(null), position = ref(null), failed = ref(false)
const style = computed(() => position.value ? { left: `${position.value.left}px`, top: `${position.value.top}px`, width: `${position.value.width}px`, height: `${position.value.height}px` } : {})
const close = () => { position.value = null }
const show = () => {
    const rect = anchor.value.getBoundingClientRect()
    const width = Math.min(360, window.innerWidth - 24), height = Math.min(280, window.innerHeight - 24)
    const below = rect.bottom + 8
    const top = below + height <= window.innerHeight - 12 ? below : Math.max(12, rect.top - height - 8)
    failed.value = false
    position.value = { width, height, left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), top }
}
const keydown = event => { if (event.key === 'Escape') close() }
onMounted(() => {
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    window.addEventListener('keydown', keydown)
})
onUnmounted(() => {
    window.removeEventListener('scroll', close, true)
    window.removeEventListener('resize', close)
    window.removeEventListener('keydown', keydown)
})
</script>
<template>
    <button ref="anchor" type="button" class="seo-image-surface size-9 shrink-0 cursor-zoom-in rounded-control border border-ui-border p-0.5" :aria-label="`Увеличить изображение: ${alt || 'без alt'}`" @mouseenter="show" @mouseleave="close" @focus="show" @blur="close" @click="show">
        <img :src="src" alt="" loading="lazy" referrerpolicy="no-referrer" class="size-full object-contain" />
    </button>
    <Teleport to="body">
        <div v-if="position" role="tooltip" aria-label="Увеличенное изображение" class="ui-preview pointer-events-none fixed z-50 flex items-center justify-center rounded-panel border border-ui-border bg-ui-panel p-2 text-xs text-ui-muted shadow-xl" :style="style">
            <span v-if="failed">Не удалось загрузить изображение</span>
            <div v-else class="seo-image-surface size-full rounded-control"><img :src="src" :alt="alt || 'Изображение без alt'" referrerpolicy="no-referrer" class="size-full object-contain" @error="failed = true" /></div>
        </div>
    </Teleport>
</template>
<style scoped>
.seo-image-surface {
    background-color: #b8bec7;
    background-image: conic-gradient(#919aa6 25%, transparent 0 50%, #919aa6 0 75%, transparent 0);
    background-size: 16px 16px;
}
</style>

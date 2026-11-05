<script setup>
import { nextTick, onDeactivated, onUnmounted, ref, useId, watch } from 'vue'
defineOptions({ inheritAttrs: false })

const props = defineProps({ text: { type: String, default: '' } })
const id = useId(), anchor = ref(null), popup = ref(null), open = ref(false), position = ref({})
let timer, hovered = false, focused = false, popupHovered = false
const close = () => {
    clearTimeout(timer)
    open.value = false
    popupHovered = false
    window.removeEventListener('scroll', place, true)
    window.removeEventListener('resize', place)
    window.removeEventListener('keydown', keydown)
}
const keydown = event => { if (event.key === 'Escape') close() }
const place = () => {
    if (!open.value || !anchor.value || !popup.value) return
    const width = Math.min(320, window.innerWidth - 24)
    const rect = anchor.value.getBoundingClientRect(), height = popup.value.getBoundingClientRect().height
    if (!anchor.value.isConnected || rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) { close(); return }
    const below = rect.bottom + 6
    const top = below + height <= window.innerHeight - 12 ? below : Math.max(12, rect.top - height - 6)
    position.value = { width: `${width}px`, left: `${Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))}px`, top: `${top}px` }
}
const show = async () => {
    clearTimeout(timer)
    if (!props.text || open.value) return
    open.value = true
    const width = Math.min(320, window.innerWidth - 24)
    position.value = { width: `${width}px`, visibility: 'hidden' }
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    window.addEventListener('keydown', keydown)
    await nextTick()
    place()
}
const hideLater = () => {
    clearTimeout(timer)
    timer = setTimeout(() => { if (!hovered && !focused && !popupHovered) close() }, 120)
}
const enterPopup = () => {
    popupHovered = true
    clearTimeout(timer)
}
watch(() => props.text, close)
onUnmounted(close)
onDeactivated(close)
</script>
<template>
    <span v-bind="$attrs" ref="anchor" :tabindex="text ? 0 : undefined" :aria-describedby="open ? id : undefined" :class="text ? 'cursor-help' : ''"
        @mouseenter="hovered = true; show()" @mouseleave="hovered = false; hideLater()" @focus="focused = true; show()" @blur="focused = false; hideLater()"><slot /></span>
    <Teleport to="body">
        <div v-if="open" :id="id" ref="popup" role="tooltip" class="ui-preview fixed z-50 max-h-[calc(100dvh-24px)] overflow-auto whitespace-pre-line rounded-control border border-ui-border bg-ui-panel px-3 py-2 text-xs leading-5 wrap-anywhere text-ui-text shadow-lg" :style="position"
            @mouseenter="enterPopup" @mouseleave="popupHovered = false; hideLater()">{{ text }}</div>
    </Teleport>
</template>

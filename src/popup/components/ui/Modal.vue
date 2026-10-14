<script setup>
import { nextTick, ref, useId, watch } from 'vue'
import IconButton from './IconButton.vue'
const open = defineModel('open', { type: Boolean, default: false })
defineProps({ title: String, fullscreen: Boolean })
const id = useId(), dialog = ref(null)
watch(open, async visible => {
    await nextTick()
    if (!dialog.value) return
    if (visible && !dialog.value.open) { dialog.value.showModal(); dialog.value.querySelector('[autofocus]')?.focus() }
    else if (!visible && dialog.value.open) dialog.value.close()
}, { immediate: true })
const backdrop = event => {
    if (event.target !== dialog.value) return
    const rect = dialog.value.getBoundingClientRect()
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) open.value = false
}
</script>
<template>
    <dialog ref="dialog" :aria-labelledby="id" class="ui-modal" :class="fullscreen ? 'ui-modal--fullscreen' : ''" @cancel.prevent="open = false" @close="open = false" @click="backdrop">
        <header class="flex items-center justify-between gap-3" :class="fullscreen ? 'shrink-0 border-b border-ui-border/70 px-4 py-2' : 'mb-4'">
            <h2 :id="id" class="ui-title">{{ title }}</h2>
            <IconButton label="Закрыть" @click="open = false"><svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></IconButton>
        </header>
        <div :class="fullscreen ? 'min-h-0 flex-1 overflow-y-auto p-4' : ''"><slot /></div>
    </dialog>
</template>

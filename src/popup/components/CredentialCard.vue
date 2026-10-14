<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import Message from './ui/Message.vue'

defineProps({ title: String, menuLabel: String, message: String, error: Boolean })
const menu = ref(null)
const close = () => { if (menu.value) menu.value.open = false }
const closeOutside = event => { if (menu.value && !menu.value.contains(event.target)) close() }
onMounted(() => document.addEventListener('pointerdown', closeOutside))
onUnmounted(() => document.removeEventListener('pointerdown', closeOutside))
defineExpose({ close })
</script>
<template>
    <article class="relative rounded-lg border border-white/10 bg-slate-900/40 p-3">
        <div class="flex items-center justify-between gap-3">
            <span class="min-w-0 break-all text-xs text-slate-300">{{ title }}</span>
            <div class="flex shrink-0 items-center gap-2">
                <slot name="quick" />
                <details ref="menu" class="relative" @keydown.esc="close">
                    <summary :aria-label="menuLabel" :title="menuLabel" class="cursor-pointer list-none rounded px-2 py-1 text-lg leading-none text-slate-400 hover:bg-white/10 hover:text-white">⋮</summary>
                    <div class="absolute right-0 top-8 z-20 grid min-w-44 gap-1 rounded-lg border border-white/10 bg-slate-800 p-1 shadow-xl">
                        <slot name="menu" />
                    </div>
                </details>
            </div>
        </div>
        <Message v-if="message" :type="error ? 'error' : 'success'" class="mt-2">{{ message }}</Message>
    </article>
</template>

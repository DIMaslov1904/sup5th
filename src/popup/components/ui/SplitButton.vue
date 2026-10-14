<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, useId, watch } from 'vue'
import Button from './Button.vue'

const props = defineProps({
    items: { type: Array, required: true },
    variant: { type: String, default: 'secondary' },
    size: { type: String, default: 'md' },
    disabled: Boolean,
    loading: Boolean,
    menuLabel: { type: String, default: 'Выбрать действие' }
})
const emit = defineEmits(['click', 'select'])
const id = useId()
const root = ref(null), trigger = ref(null), panel = ref(null)
const open = ref(false), above = ref(false)
const blocked = computed(() => props.disabled || props.loading)
const choices = () => [...(panel.value?.querySelectorAll('button:not(:disabled)') || [])]
const close = (restoreFocus = false) => {
    open.value = false
    if (restoreFocus) trigger.value?.$el.focus()
}
const show = async (last = false) => {
    if (blocked.value) return
    open.value = true
    above.value = false
    await nextTick()
    if (!open.value || !root.value || !panel.value) return
    const rect = root.value.getBoundingClientRect(), height = panel.value.offsetHeight
    above.value = innerHeight - rect.bottom < height + 8 && rect.top > height + 8
    const buttons = choices()
    buttons[last ? buttons.length - 1 : 0]?.focus()
}
const toggle = () => open.value ? close() : show()
const select = item => {
    if (blocked.value || item.disabled) return
    close(true)
    emit('select', item.value)
}
const navigate = event => {
    if (event.key === 'Escape') { event.preventDefault(); close(true); return }
    if (event.key === 'Tab') { close(); return }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const buttons = choices(), index = buttons.indexOf(document.activeElement)
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
        : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
    buttons[next]?.focus()
}
const outside = event => { if (!root.value?.contains(event.target)) close() }
watch(blocked, value => { if (value) close() })
onMounted(() => document.addEventListener('pointerdown', outside))
onUnmounted(() => document.removeEventListener('pointerdown', outside))
</script>

<template>
    <div ref="root" class="relative inline-flex max-w-full justify-self-start">
        <Button :variant="variant" :size="size" :disabled="disabled" :loading="loading" class="min-w-0 rounded-r-none"
            @click="close(); emit('click', $event)"><slot /></Button>
        <Button ref="trigger" :variant="variant" :size="size" :disabled="blocked || !items.some(item => !item.disabled)"
            :aria-label="menuLabel" :title="menuLabel" aria-haspopup="menu" :aria-expanded="open" :aria-controls="id"
            class="w-9 rounded-l-none border-l-0 px-0" @click="toggle" @keydown.down.prevent="show()" @keydown.up.prevent="show(true)" @keydown.esc="close()">
            <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
        </Button>
        <div v-if="open" :id="id" ref="panel" role="menu" :aria-label="menuLabel" class="ui-menu absolute left-0 z-20 w-max max-w-[calc(100vw-4rem)]"
            :class="above ? 'bottom-full mb-1' : 'top-full mt-1'" @keydown="navigate">
            <button v-for="item in items" :key="item.value" type="button" role="menuitem" :disabled="blocked || item.disabled"
                class="ui-menu-item focus-visible:outline-2 focus-visible:outline-ui-accent focus-visible:-outline-offset-2" @click="select(item)">{{ item.label }}</button>
        </div>
    </div>
</template>

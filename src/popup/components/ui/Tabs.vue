<script setup>
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import IconButton from './IconButton.vue'
const value = defineModel({ type: String, default: '' })
const props = defineProps({ items: { type: Array, required: true }, label: { type: String, default: 'Разделы' }, wrap: Boolean })
const scroller = ref(null)
const canLeft = ref(false), canRight = ref(false)
let observer
const bounds = () => {
    if (props.wrap) { canLeft.value = false; canRight.value = false; return }
    if (!scroller.value) return
    canLeft.value = scroller.value.scrollLeft > 1
    canRight.value = scroller.value.scrollLeft + scroller.value.clientWidth < scroller.value.scrollWidth - 1
}
const reveal = () => {
    if (props.wrap) return
    const active = scroller.value?.querySelector('[aria-selected="true"]')
    if (!active) return
    const rect = active.getBoundingClientRect(), area = scroller.value.getBoundingClientRect()
    if (rect.left < area.left) scroller.value.scrollLeft -= area.left - rect.left
    else if (rect.right > area.right) scroller.value.scrollLeft += rect.right - area.right
    bounds()
}
const scroll = direction => scroller.value?.scrollBy({ left: direction * Math.max(150, scroller.value.clientWidth * 0.8), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
onMounted(() => { observer = new ResizeObserver(() => { bounds(); reveal() }); observer.observe(scroller.value) })
onUnmounted(() => observer?.disconnect())
watch([value, () => props.wrap], async () => { await nextTick(); bounds(); reveal() }, { immediate: true })
const move = async (event, index) => {
    const key = event.key
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)) return
    event.preventDefault()
    const next = key === 'Home' ? 0 : key === 'End' ? props.items.length - 1 : (index + (key === 'ArrowRight' ? 1 : -1) + props.items.length) % props.items.length
    value.value = props.items[next][0]
    await nextTick()
    scroller.value?.querySelector('[aria-selected="true"]')?.focus({ preventScroll: true })
    reveal()
}
</script>
<template>
    <div class="flex min-w-0 items-center gap-1 rounded-panel border border-ui-border/60 bg-ui-field/65 p-1">
        <IconButton v-if="!wrap && (canLeft || canRight)" label="Предыдущие разделы" :disabled="!canLeft" class="size-7" @click="scroll(-1)"><svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg></IconButton>
        <nav ref="scroller" role="tablist" aria-orientation="horizontal" :aria-label="label" class="relative flex min-w-0 flex-1 items-center gap-1" :class="wrap ? 'flex-wrap' : 'ui-tabs-scroll overflow-x-auto'" @scroll="bounds">
            <button v-for="(item, index) in items" :key="item[0]" type="button" role="tab" :aria-selected="value === item[0]" class="ui-tab" :class="wrap ? 'grow' : ''" @click="value = item[0]" @keydown="move($event, index)">{{ item[1] }}</button>
        </nav>
        <IconButton v-if="!wrap && (canLeft || canRight)" label="Следующие разделы" :disabled="!canRight" class="size-7" @click="scroll(1)"><svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="m10 6 6 6-6 6" /></svg></IconButton>
    </div>
</template>

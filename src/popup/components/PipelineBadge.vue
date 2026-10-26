<script setup>
import { onUnmounted, ref, watch } from 'vue'
import { pipelineBadgeSession } from '../pipelineBadgeState.js'
import Button from './ui/Button.vue'
import IconButton from './ui/IconButton.vue'

const props = defineProps({ repository: { type: String, default: '' } })
const links = ref(null), result = ref(''), busy = ref(false), retry = ref(0)
const source = ref(''), visible = ref(false)
const clearSource = () => {
    if (source.value) URL.revokeObjectURL(source.value)
    source.value = ''; visible.value = false; links.value = null
}
onUnmounted(clearSource)
watch([() => props.repository, retry], async ([repository], previous, onCleanup) => {
    let active = true
    if (previous?.[0] !== repository) { clearSource(); result.value = '' }
    busy.value = true
    onCleanup(() => { active = false })
    const info = await pipelineBadgeSession.load(repository, { force: previous?.[0] === repository && retry.value > 0 })
    if (!active) return
    busy.value = false; result.value = info.state
    clearSource()
    if (!info.blob) return
    links.value = info.links
    source.value = URL.createObjectURL(info.blob)
}, { immediate: true })
</script>
<template>
    <div v-if="source && links" v-show="visible" class="group flex max-w-[40%] shrink-0 items-center gap-1" :aria-busy="busy">
        <a :href="links.commitsUrl" target="_blank" rel="noreferrer" :title="`Открыть коммиты ${links.branch}`"
            class="min-w-0 rounded focus-visible:outline-2 focus-visible:outline-ui-accent">
            <img :key="source" :src="source" alt="pipeline status" class="h-5 max-w-full object-contain" @load="visible = true" @error="visible = false" />
        </a>
        <IconButton label="Обновить статус pipeline" :disabled="busy" class="size-5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100" @click="retry++">
            <svg class="size-3.5" :class="{ 'motion-safe:animate-spin': busy }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 7v5h-5 M4 17v-5h5 M6.1 6.1A8 8 0 0 1 20 12 M4 12a8 8 0 0 0 13.9 5.9" /></svg>
        </IconButton>
    </div>
    <Button v-else-if="['missing','unknown'].includes(result)" size="sm" variant="ghost" :disabled="busy" :title="result === 'missing' ? 'Pipeline не найден в main и master' : 'Не удалось проверить pipeline'" @click="retry++">Проверить снова</Button>
</template>

<script setup>
import { ref, watch } from 'vue'
import { pipelineBadgeSession } from '../pipelineBadgeState.js'
import Button from './ui/Button.vue'

const props = defineProps({ repository: { type: String, default: '' } })
const links = ref(null), result = ref(''), busy = ref(false), retry = ref(0)
const source = ref(''), visible = ref(false)
watch([() => props.repository, retry], async ([repository], previous, onCleanup) => {
    let active = true, objectUrl = ''
    source.value = ''; visible.value = false; busy.value = true; links.value = null
    onCleanup(() => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) })
    const info = await pipelineBadgeSession.load(repository, { force: previous?.[0] === repository && retry.value > 0 })
    if (!active) return
    busy.value = false; result.value = info.state
    if (!info.blob) return
    links.value = info.links
    objectUrl = URL.createObjectURL(info.blob)
    source.value = objectUrl
}, { immediate: true })
</script>
<template>
    <a v-if="source && links" v-show="visible" :href="links.commitsUrl" target="_blank" rel="noreferrer"
        :title="`Открыть коммиты ${links.branch}`" class="block max-w-[40%] shrink-0 rounded focus-visible:outline-2 focus-visible:outline-ui-accent">
        <img :key="source" :src="source" alt="pipeline status" class="h-5 max-w-full object-contain" @load="visible = true" @error="visible = false" />
    </a>
    <Button v-else-if="['missing','unknown'].includes(result)" size="sm" variant="ghost" :disabled="busy" :title="result === 'missing' ? 'Pipeline не найден в main и master' : 'Не удалось проверить pipeline'" @click="retry++">Проверить снова</Button>
</template>

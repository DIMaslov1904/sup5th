<script setup>
import { computed, ref, watch } from 'vue'
import { getPipelineLinks } from '../pipelineBadgeSession.js'
import { pipelineBadgeSession } from '../pipelineBadgeState.js'

const props = defineProps({ repository: { type: String, default: '' } })
const links = computed(() => getPipelineLinks(props.repository))
const source = ref(''), visible = ref(false)
watch(() => props.repository, async (repository, previous, onCleanup) => {
    let active = true, objectUrl = ''
    source.value = ''; visible.value = false
    onCleanup(() => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) })
    const blob = await pipelineBadgeSession.load(repository)
    if (!active || !blob) return
    objectUrl = URL.createObjectURL(blob)
    source.value = objectUrl
}, { immediate: true })
</script>
<template>
    <a v-if="source && links" v-show="visible" :href="links.commitsUrl" target="_blank" rel="noreferrer"
        title="Открыть коммиты main" class="block max-w-[40%] shrink-0 rounded focus-visible:outline-2 focus-visible:outline-ui-accent">
        <img :key="source" :src="source" alt="pipeline status" class="h-5 max-w-full object-contain" @load="visible = true" @error="visible = false" />
    </a>
</template>

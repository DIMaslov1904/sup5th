<script setup>
import { extensionApi } from '../../platform/extensionApi.js'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { iconRepository } from '../../icons/iconRepository.js'
import { iconInitials, iconOrigin } from '../../icons/iconPolicy.js'
import { iconBackgroundFromPixels } from '../../icons/iconAppearance.js'

const props = defineProps({ url: String, name: String, large: Boolean })
const source = ref(''), background = ref('transparent')
const origin = computed(() => iconOrigin(props.url))
let revision = 0, disposed = false
const revoke = () => { if (source.value) URL.revokeObjectURL(source.value); source.value = ''; background.value = 'transparent' }
const analyze = event => {
    const image = event.target
    if (image.src !== source.value) return
    try {
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = 32
        const context = canvas.getContext('2d', { willReadFrequently: true })
        context.drawImage(image, 0, 0, 32, 32)
        background.value = iconBackgroundFromPixels(context.getImageData(0, 0, 32, 32).data)
    } catch { background.value = 'white' }
}
const load = async () => {
    const current = ++revision
    try {
        const record = origin.value ? await iconRepository.get(origin.value) : null
        if (disposed || current !== revision) return
        revoke()
        if (record?.image) source.value = URL.createObjectURL(record.image)
    } catch { if (current === revision) revoke() }
}
const changed = message => {
    if (message.type === 'icons:changed' && (message.cleared || message.origin === origin.value)) load()
}
watch(origin, load)
onMounted(() => { extensionApi.runtime.onMessage.addListener(changed); load() })
onUnmounted(() => { disposed = true; revision++; extensionApi.runtime.onMessage.removeListener(changed); revoke() })
</script>

<template>
    <span aria-hidden="true" :class="[large ? 'size-12' : 'size-8', {'border border-ui-border bg-ui-raised': !source, 'bg-white': source && background === 'white'}]" class="flex rounded-panel shrink-0 items-center justify-center overflow-hidden text-[11px] font-semibold text-ui-muted">
        <img v-if="source" :src="source" alt="" class="h-full w-full object-contain" @load="analyze" @error="revoke" />
        <span v-else>{{ iconInitials(name || origin) }}</span>
    </span>
</template>

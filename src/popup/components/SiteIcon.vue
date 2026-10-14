<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { iconRepository } from '../../icons/iconRepository.js'
import { iconInitials, iconOrigin } from '../../icons/iconPolicy.js'

const props = defineProps({ url: String, name: String, large: Boolean })
const source = ref('')
const origin = computed(() => iconOrigin(props.url))
let revision = 0, disposed = false
const revoke = () => { if (source.value) URL.revokeObjectURL(source.value); source.value = '' }
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
onMounted(() => { chrome.runtime.onMessage.addListener(changed); load() })
onUnmounted(() => { disposed = true; revision++; chrome.runtime.onMessage.removeListener(changed); revoke() })
</script>

<template>
    <span aria-hidden="true" :class="[large ? 'size-12' : 'size-8', {'border border-white/10 bg-slate-800': !source, 'bg-white': source}]" class="flex rounded-lg shrink-0 items-center justify-center overflow-hidden text-[11px] font-semibold text-slate-300">
        <img v-if="source" :src="source" alt="" class="h-full w-full object-contain" @error="revoke" />
        <span v-else>{{ iconInitials(name || origin) }}</span>
    </span>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { extensionApi } from '../../platform/extensionApi.js'
import { loadProjectData } from '../data/projectData.js'
import { projectShortcuts } from '../projectShortcutsState.js'
import { selectProjectShortcuts } from '../../utils/projectShortcuts.js'
import SiteIcon from './SiteIcon.vue'
import Notification from './ui/Notification.vue'
import HeartIcon from './ui/HeartIcon.vue'
const emit = defineEmits(['select'])
const projects = ref([]), error = ref('')
let alive = true, revision = 0
const items = computed(() => selectProjectShortcuts(projects.value, projectShortcuts.value))
const load = async () => {
    const current = ++revision
    try { const data = await loadProjectData(); if (alive && current === revision) projects.value = data.lastSuccessfulData.projects }
    catch (reason) { if (alive) error.value = reason.message }
}
const changed = (changes, area) => { if (area === 'local' && changes.projectData) load() }
onMounted(() => { extensionApi.storage.onChanged.addListener(changed); load() })
onUnmounted(() => { alive = false; revision++; extensionApi.storage.onChanged.removeListener(changed) })
</script>
<template>
    <nav v-if="items.length" aria-label="Избранные и последние проекты" class="project-shortcuts mb-3 flex gap-2 py-1">
        <button v-for="project in items" :key="project.url" type="button" :aria-label="`Открыть проект ${project.name || project.url}`" class="project-shortcut relative flex shrink-0 cursor-pointer items-center justify-center rounded-panel border border-ui-border bg-ui-panel p-1.5" @click="emit('select', project.url)">
            <SiteIcon :url="project.siteUrl || project.url" :name="project.name" class="project-shortcut-icon rounded-control!" />
            <span v-if="project.pinned" class="pointer-events-none absolute top-0.5 right-0.5 rounded-full bg-ui-panel p-0.5 text-ui-danger" aria-hidden="true"><HeartIcon class="size-3" filled /></span>
        </button>
    </nav>
    <Notification v-if="error" :text="error" />
</template>
<style scoped>
.project-shortcuts { container-type: inline-size; }
.project-shortcut { width: calc((100% - 48px) / 7); height: calc((100cqw - 48px) / 7); }
.project-shortcut-icon { width: clamp(24px, calc((100cqw - 48px) / 7 - 14px), 44px); height: clamp(24px, calc((100cqw - 48px) / 7 - 14px), 44px); }
</style>

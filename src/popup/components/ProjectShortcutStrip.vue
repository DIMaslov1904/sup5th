<script setup>
import { computed } from 'vue'
import { projectShortcuts } from '../projectShortcutsState.js'
import { selectProjectShortcuts } from '../../utils/projectShortcuts.js'
import SiteIcon from './SiteIcon.vue'
import HeartIcon from './ui/HeartIcon.vue'
const props = defineProps({ projects: { type: Array, required: true } })
const emit = defineEmits(['select'])
const items = computed(() => selectProjectShortcuts(props.projects, projectShortcuts.value))
</script>
<template>
    <nav v-if="items.length" aria-label="Избранные и последние проекты" class="project-shortcuts mb-3 flex gap-2 py-1">
        <button v-for="project in items" :key="project.url" type="button" :aria-label="`Открыть проект ${project.name || project.url}`" class="project-shortcut relative flex shrink-0 cursor-pointer items-center justify-center rounded-panel border border-ui-border bg-ui-panel p-1.5" @click="emit('select', project.url)">
            <SiteIcon :url="project.siteUrl || project.url" :name="project.name" class="project-shortcut-icon rounded-control!" />
            <span v-if="project.pinned" class="pointer-events-none absolute top-0.5 right-0.5 rounded-full bg-ui-panel p-0.5 text-ui-danger" aria-hidden="true"><HeartIcon class="size-3" filled /></span>
        </button>
    </nav>
</template>
<style scoped>
.project-shortcuts { container-type: inline-size; }
.project-shortcut { width: calc((100% - 48px) / 7); height: calc((100cqw - 48px) / 7); }
.project-shortcut-icon { width: clamp(24px, calc((100cqw - 48px) / 7 - 14px), 44px); height: clamp(24px, calc((100cqw - 48px) / 7 - 14px), 44px); }
</style>

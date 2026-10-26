<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { extensionApi } from '../../platform/extensionApi.js'
import { loadProjectData } from '../data/projectData.js'
import { projectShortcuts, recordProjectOpen } from '../projectShortcutsState.js'
import { selectProjectShortcuts } from '../../utils/projectShortcuts.js'
import { siteHref } from '../../utils/siteAddress.js'
import SiteIcon from './SiteIcon.vue'
import Notification from './ui/Notification.vue'
import HeartIcon from './ui/HeartIcon.vue'
const emit = defineEmits(['select'])
const projects = ref([]), scroller = ref(null), error = ref('')
const hovered = ref(''), focused = ref('')
let alive = true, revision = 0, hoverTimer
const items = computed(() => selectProjectShortcuts(projects.value, projectShortcuts.value))
const load = async () => {
    const current = ++revision
    try { const data = await loadProjectData(); if (alive && current === revision) projects.value = data.lastSuccessfulData.projects }
    catch (reason) { if (alive) error.value = reason.message }
}
const changed = (changes, area) => { if (area === 'local' && changes.projectData) load() }
onMounted(() => { extensionApi.storage.onChanged.addListener(changed); load() })
onUnmounted(() => { alive = false; revision++; clearTimeout(hoverTimer); extensionApi.storage.onChanged.removeListener(changed) })
const leave = () => { clearTimeout(hoverTimer); hoverTimer = setTimeout(() => { hovered.value = '' }, 500) }
const hover = url => { clearTimeout(hoverTimer); hoverTimer = setTimeout(() => { hovered.value = url }, 300) }
const blur = event => { if (!event.currentTarget.contains(event.relatedTarget)) focused.value = '' }
const visit = project => recordProjectOpen(project.url).catch(reason => { error.value = reason.message })
const select = project => emit('select', project.url)
const wheel = event => {
    const el = scroller.value
    if (!el || Math.abs(event.deltaX) >= Math.abs(event.deltaY) || el.scrollWidth <= el.clientWidth) return
    const before = el.scrollLeft; el.scrollLeft += event.deltaY
    if (el.scrollLeft !== before) event.preventDefault()
}
const reveal = event => { if (event.propertyName === 'width') event.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' }) }
</script>
<template>
    <nav v-if="items.length" ref="scroller" aria-label="Избранные и последние проекты" class="project-shortcuts mb-3 flex shrink-0 gap-2 overflow-x-auto overscroll-x-contain py-1" @wheel="wheel">
        <article v-for="project in items" :key="project.url" class="project-shortcut relative flex shrink-0 items-center justify-center rounded-panel border border-ui-border bg-ui-panel p-1.5" :class="{'is-open': hovered === project.url || focused === project.url}" @mouseenter="hover(project.url)" @mouseleave="leave" @focusin="focused = project.url" @focusout="blur" @transitionend.self="reveal">
            <button type="button" :aria-label="`Открыть проект ${project.name || project.url}`" class="flex min-w-0 flex-1 cursor-pointer items-center overflow-hidden rounded-control text-left" @click="select(project)">
                <SiteIcon :url="project.siteUrl || project.url" :name="project.name" class="project-shortcut-icon rounded-control!" />
                <span class="project-shortcut-name truncate text-xs font-medium">{{ project.name || project.url }}</span>
            </button>
            <span v-if="project.pinned" class="pointer-events-none absolute top-0.5 right-0.5 rounded-full bg-ui-panel p-0.5 text-ui-danger" aria-hidden="true"><HeartIcon class="size-3" filled /></span>
            <a :href="siteHref(project.siteUrl || project.url)" target="_blank" rel="noreferrer" :aria-label="`Перейти на сайт ${project.name || project.url}`" class="project-shortcut-open shrink-0 overflow-hidden rounded-control text-center text-ui-accent" @click="visit(project)">↗</a>
        </article>
    </nav>
    <Notification v-if="error" :text="error" />
</template>
<style scoped>
.project-shortcuts { container-type: inline-size; }
.project-shortcut { width: calc((100% - 48px) / 7); height: calc((100cqw - 48px) / 7); transition: width 140ms ease-out; }
.project-shortcut-icon { width: clamp(24px, calc((100cqw - 48px) / 7 - 14px), 44px); height: clamp(24px, calc((100cqw - 48px) / 7 - 14px), 44px); }
.project-shortcut.is-open { width: 224px; }
.project-shortcut-name { max-width: 0; opacity: 0; transition: opacity 120ms ease-out, max-width 140ms ease-out, margin 140ms ease-out; }
.project-shortcut-open { width: 0; opacity: 0; transition: opacity 120ms ease-out, width 140ms ease-out; }
.project-shortcut.is-open .project-shortcut-name { max-width: 132px; margin-left: 8px; opacity: 1; }
.project-shortcut.is-open .project-shortcut-open { width: 24px; opacity: 1; }
@media (prefers-reduced-motion: reduce) { .project-shortcut, .project-shortcut-name, .project-shortcut-open { transition: none; } }
</style>

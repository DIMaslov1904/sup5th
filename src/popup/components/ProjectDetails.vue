<script setup>
import { extensionApi } from '../../platform/extensionApi.js'
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { loadProjectDetails } from '../data/projectData'
import { getAdminUrl, getCmsIconPath, getTicketUrl } from '../../utils/projectUtils'
import { siteHref } from '../../utils/siteAddress.js'
import { displayUrl } from '../../utils/displayUrl.js'
import SiteIcon from './SiteIcon.vue'
import PipelineBadge from './PipelineBadge.vue'
import { pipelineBadgePreference } from '../pipelineBadgeState.js'
import ProjectAccessCard from './ProjectAccessCard.vue'
import FtpAccessCard from './FtpAccessCard.vue'
import Notification from './ui/Notification.vue'

const props = defineProps({ project: { type: Object, required: true } })
const accesses = ref([]), loading = ref(false), error = ref('')
const href = siteHref
const actions = computed(() => [
    { kind: 'admin', label: 'В админку', url: getAdminUrl(props.project) },
    { kind: 'manual', label: 'Инструкция', url: href(props.project.manual) },
    { kind: 'git', label: 'Git', url: href(props.project.git) },
    { kind: 'ticket', label: 'Создать тикет', url: getTicketUrl(props.project) }
])
const ftpAccesses = computed(() => accesses.value.map((access, index) => ({ access, index })).filter(item => item.access.hasFtp))
let revision = 0
const reload = async (url = props.project.url) => {
    const current = ++revision
    accesses.value = []; loading.value = true; error.value = ''
    try { const details = await loadProjectDetails(url); if (current === revision) accesses.value = details.accesses }
    catch (reason) { if (current === revision) error.value = reason.message }
    finally { if (current === revision) loading.value = false }
}
watch(() => props.project.url, reload, { immediate: true })
const changed = changes => { if (changes.projectData || changes.credentialSecurity || changes.unlockedCredentialVaultKey) reload() }
onMounted(() => extensionApi.storage.onChanged.addListener(changed))
onUnmounted(() => { revision++; extensionApi.storage.onChanged.removeListener(changed) })
</script>
<template>
    <div class="grid min-w-0 grid-cols-1 gap-4 text-ui-text">
        <header class="flex min-w-0 items-center gap-3">
            <slot name="leading" />
            <SiteIcon :url="project.siteUrl || project.url" :name="project.name" large />
            <div class="min-w-0 flex-1">
                <h1 :title="project.name || displayUrl(project.url)" class="ui-title line-clamp-2 wrap-anywhere">{{ project.name || displayUrl(project.url) }}</h1>
                <a :href="href(project.siteUrl || project.url)" :title="displayUrl(project.url)" target="_blank" rel="noreferrer" class="inline-block truncate text-xs text-ui-muted hover:text-ui-accent">{{ displayUrl(project.url) }}</a>
            </div>
            <PipelineBadge v-if="pipelineBadgePreference.enabled" :repository="project.git" />
        </header>
        <div class="grid grid-cols-4 gap-2">
            <a v-for="action in actions" :key="action.kind" :href="action.url || undefined" target="_blank" rel="noreferrer" :aria-disabled="!action.url" :tabindex="action.url ? undefined : -1"
                class="ui-action-tile"
                :class="action.url ? '' : 'pointer-events-none opacity-40'">
                <span v-if="action.kind === 'admin'" class="flex size-8 items-center justify-center rounded bg-white p-1"><img :src="getCmsIconPath(project.cms)" :alt="project.cms || 'CMS'" class="size-full object-contain" /></span>
                <svg v-else-if="action.kind === 'manual'" class="size-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 3h12l4 4v14H4Z M15 3v5h5 M8 12h8 M8 16h6" /></svg>
                <svg v-else-if="action.kind === 'git'" class="size-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><circle cx="6" cy="5" r="2" /><circle cx="6" cy="19" r="2" /><circle cx="18" cy="6" r="2" /><path d="M6 7v10 M18 8v2c0 4-12 4-12 7" /></svg>
                <svg v-else class="size-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5h18v5a2 2 0 0 0 0 4v5H3v-5a2 2 0 0 0 0-4Z M12 8v8 M9 12h6" /></svg>
                <span>{{ action.label }}</span>
            </a>
        </div>
        <section class="grid gap-2">
            <h2 class="text-[13px] font-semibold">Доступы</h2>
            <p v-if="loading" class="text-xs text-ui-muted">Загрузка доступов…</p>
            <p v-else-if="!accesses.length && !error" class="text-xs text-ui-muted">Для проекта нет сохранённых доступов</p>
            <ProjectAccessCard v-for="(access, index) in accesses" :key="access.id" :access="access" :project="project" :index="index" />
        </section>
        <section v-if="ftpAccesses.length" class="grid gap-2">
            <h2 class="text-[13px] font-semibold">FTP доступы</h2>
            <FtpAccessCard v-for="item in ftpAccesses" :key="item.access.id" :access="item.access" :project-url="project.url" :index="item.index" />
        </section>
        <Notification v-if="error" :text="error" />
    </div>
</template>

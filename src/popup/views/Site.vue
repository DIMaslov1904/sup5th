<script setup>
import { extensionApi } from '../../platform/extensionApi.js'
import { onMounted, onUnmounted, ref } from 'vue'
import { loadPanelAttention, loadProjectData, refreshAll } from '../data/projectData.js'
import { findProjectByUrl, projectKey } from '../../utils/projectUtils.js'
import { ensureUnlocked } from '../unlockStore.js'
import ProjectDetails from '../components/ProjectDetails.vue'
import Button from '../components/ui/Button.vue'
import Message from '../components/ui/Message.vue'
import EmptyState from '../components/ui/EmptyState.vue'

const emit = defineEmits(['open-project'])
const project = ref(null), loaded = ref(false), error = ref('')
const attention = ref(null), attentionError = ref(''), actionError = ref(''), opening = ref(false)
let alive = true, revision = 0, connectionRevision = 0, catalogue = []

const load = async () => {
    const current = ++revision
    attention.value = null
    attentionError.value = ''
    try {
        const [tabs, data] = await Promise.all([
            extensionApi.tabs.query({ active: true, currentWindow: true }),
            loadProjectData()
        ])
        if (!alive || current !== revision) return
        const tab = tabs[0]
        catalogue = data.lastSuccessfulData?.projects || []
        project.value = tab?.url && /^https?:/.test(tab.url) ? findProjectByUrl(catalogue, tab.url) : null
        error.value = ''
    } catch (reason) { if (alive && current === revision) error.value = reason.message }
    finally { if (alive && current === revision) loaded.value = true }

    if (!alive || current !== revision || project.value || error.value) return
    try {
        const result = await loadPanelAttention()
        if (alive && current === revision) attention.value = result
    } catch (reason) { if (alive && current === revision) attentionError.value = reason.message }
}

const openProject = async projectId => {
    if (opening.value) return
    const current = connectionRevision
    const findProject = projects => projects.find(item => item.id === String(projectId))
    actionError.value = ''
    opening.value = true
    try {
        let selected = findProject(catalogue)
        if (!selected) {
            await refreshAll({ scope: 'projects' })
            const data = await loadProjectData()
            selected = findProject(data.lastSuccessfulData.projects)
        }
        if (!selected) throw new Error('Проект не найден в каталоге. Обновите список и повторите попытку.')
        if (alive && current === connectionRevision) emit('open-project', projectKey(selected))
    } catch (reason) { if (alive && current === connectionRevision) actionError.value = reason.message }
    finally { opening.value = false }
}

const unlock = () => {
    actionError.value = ''
    return ensureUnlocked(async () => {}, { refreshAfterUnlock: false }).catch(reason => { actionError.value = reason.message })
}
const changed = (changes, area) => {
    if (area === 'local' && changes.apiSettings) {
        connectionRevision++
        actionError.value = ''
    }
    if ((area === 'local' && (changes.projectData || changes.apiSettings || changes.credentialSecurity))
        || (area === 'session' && changes.unlockedCredentialVaultKey)) load()
}
onMounted(() => { extensionApi.storage.onChanged.addListener(changed); load() })
onUnmounted(() => { alive = false; revision++; extensionApi.storage.onChanged.removeListener(changed) })
</script>
<template>
    <section class="flex min-w-0 flex-1 flex-col px-4 text-ui-text">
        <p v-if="!loaded" class="text-[13px] text-ui-muted">Загрузка…</p>
        <Message v-else-if="error" type="error">{{ error }}</Message>
        <ProjectDetails v-else-if="project" :key="projectKey(project)" :project="project" />
        <div v-else-if="attention?.rows.length || attention?.status === 'locked' || attentionError" class="grid gap-3">
            <h1 class="ui-title">Требует внимания</h1>
            <Message v-if="attentionError" type="error">{{ attentionError }}</Message>
            <Button v-if="attentionError" variant="secondary" size="sm" @click="load">Повторить загрузку</Button>
            <Button v-else-if="attention?.status === 'locked'" variant="secondary" size="sm" @click="unlock">Разблокировать хранилище</Button>
            <ul v-else class="grid gap-2">
                <li v-for="(item, index) in attention.rows" :key="index">
                    <button type="button" :disabled="opening" class="ui-panel grid w-full cursor-pointer gap-1 text-left hover:border-ui-accent/40 focus-visible:outline-2 focus-visible:outline-ui-accent"
                        @click="openProject(item.project_id)">
                        <span class="text-xs font-semibold" :class="item.color === 'danger' ? 'text-ui-danger' : 'text-ui-warning'">{{ item.kind }}</span>
                        <span class="wrap-anywhere text-[13px] font-medium">{{ item.name }}</span>
                        <span class="wrap-anywhere text-xs text-ui-muted">{{ item.detail }}</span>
                    </button>
                </li>
            </ul>
            <Message v-if="actionError" type="error">{{ actionError }}</Message>
        </div>
        <p v-else-if="!attention" class="text-[13px] text-ui-muted" role="status">Загрузка…</p>
        <EmptyState v-else title="Сайта нет в каталоге." />
    </section>
</template>

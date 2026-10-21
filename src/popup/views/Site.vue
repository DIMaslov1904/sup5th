<script setup>
import { extensionApi } from '../../platform/extensionApi.js'
import { onMounted, onUnmounted, ref } from 'vue'
import { loadProjectData } from '../data/projectData'
import { findProjectByUrl } from '../../utils/projectUtils'
import ProjectDetails from '../components/ProjectDetails.vue'
import Message from '../components/ui/Message.vue'
import EmptyState from '../components/ui/EmptyState.vue'

const project = ref(null), loaded = ref(false), error = ref('')
let alive = true, revision = 0
const load = async () => {
    const current = ++revision
    try {
        const [tabs, data] = await Promise.all([
            extensionApi.tabs.query({ active: true, currentWindow: true }),
            loadProjectData()
        ])
        if (!alive || current !== revision) return
        const tab = tabs[0]
        project.value = tab?.url && /^https?:/.test(tab.url) ? findProjectByUrl(data.lastSuccessfulData?.projects || [], tab.url) : null
        error.value = ''
    } catch (reason) { if (alive && current === revision) error.value = reason.message }
    finally { if (alive && current === revision) loaded.value = true }
}
const changed = (changes, area) => { if (area === 'local' && changes.projectData) load() }
onMounted(() => { extensionApi.storage.onChanged.addListener(changed); load() })
onUnmounted(() => { alive = false; revision++; extensionApi.storage.onChanged.removeListener(changed) })
</script>
<template>
    <section class="min-h-full min-w-0 w-full px-4 text-ui-text">
        <p v-if="!loaded" class="text-[13px] text-ui-muted">Загрузка…</p>
        <Message v-else-if="error" type="error">{{ error }}</Message>
        <EmptyState v-else-if="!project" title="Данный сайт не является нашим проектом." description="Найдите проект в поиске или откройте SEO для проверки текущей страницы." />
        <ProjectDetails v-else :key="project.url" :project="project" />
    </section>
</template>

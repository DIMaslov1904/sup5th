<script setup>
import { onMounted, ref } from 'vue'
import { loadProjectData } from '../data/projectData'
import { findProjectByUrl } from '../../utils/projectUtils'
import ProjectDetails from '../components/ProjectDetails.vue'
import Message from '../components/ui/Message.vue'
import EmptyState from '../components/ui/EmptyState.vue'

const project = ref(null), loaded = ref(false), error = ref('')
onMounted(async () => {
    try {
        const [tabs, data] = await Promise.all([
            chrome.tabs.query({ active: true, currentWindow: true }),
            loadProjectData()
        ])
        const tab = tabs[0]
        if (tab?.url && /^https?:/.test(tab.url)) project.value = findProjectByUrl(data.lastSuccessfulData?.projects || [], tab.url)
    } catch (reason) { error.value = reason.message }
    finally { loaded.value = true }
})
</script>
<template>
    <section class="min-h-full min-w-0 w-full px-4 text-ui-text">
        <p v-if="!loaded" class="text-[13px] text-ui-muted">Загрузка…</p>
        <Message v-else-if="error" type="error">{{ error }}</Message>
        <EmptyState v-else-if="!project" title="Данный сайт не является нашим проектом." description="Найдите проект в поиске или откройте SEO для проверки текущей страницы." />
        <ProjectDetails v-else :project="project" />
    </section>
</template>

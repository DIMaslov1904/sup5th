<script setup>
import { onMounted, ref } from 'vue'
import { loadProjectData } from '../data/projectData'
import { findProjectByUrl } from '../../utils/projectUtils'
import ProjectDetails from '../components/ProjectDetails.vue'
import Message from '../components/ui/Message.vue'

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
    <section class="min-h-full w-full px-4 text-slate-200">
        <p v-if="!loaded" class="text-sm text-slate-400">Загрузка…</p>
        <Message v-else-if="error" type="error">{{ error }}</Message>
        <p v-else-if="!project" class="text-sm text-slate-400">Данный сайт не является нашим проектом.</p>
        <ProjectDetails v-else :project="project" />
    </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { loadApiSettings, loadErrorLog, loadProjectData, refreshAll, saveApiSettings } from '../data/projectData'

const settings = ref({ projectsUrl: '', accessUrl: '' })
const projects = ref([])
const updatedAt = ref(null)
const search = ref('')
const loading = ref(false)
const message = ref('')
const errors = ref([])

const filteredProjects = computed(() => {
    const query = search.value.trim().toLowerCase()
    if (!query) return projects.value
    return projects.value.filter((project) =>
        `${project.name} ${project.url}`.toLowerCase().includes(query)
    )
})

const formatDate = (value) => value ? new Date(value).toLocaleString() : ''

const applyData = (data) => {
    projects.value = data.lastSuccessfulData.projects
    updatedAt.value = Math.max(
        data.lastSuccessfulData.projectsUpdatedAt || 0,
        data.lastSuccessfulData.accessesUpdatedAt || 0
    ) || null
}

onMounted(async () => {
    try {
        const [savedSettings, data, savedErrors] = await Promise.all([
            loadApiSettings(),
            loadProjectData(),
            loadErrorLog()
        ])
        settings.value = savedSettings
        applyData(data)
        errors.value = savedErrors
    } catch (error) {
        message.value = error.message
    }
})

const updateProjects = async () => {
    loading.value = true
    message.value = ''
    try {
        await saveApiSettings(settings.value)
        const data = await refreshAll(settings.value)
        applyData(data)
        errors.value = await loadErrorLog()
        message.value = data.refreshErrors?.length
            ? `Частичное обновление: ${data.refreshErrors.join('; ')}`
            : 'Проекты и доступы обновлены'
    } catch (error) {
        message.value = error.message
        const data = await loadProjectData()
        applyData(data)
        errors.value = await loadErrorLog()
    } finally {
        loading.value = false
    }
}
</script>

<template>
    <section class="w-full px-4 pt-5 text-slate-200">
        <div class="flex items-center justify-between gap-3 mb-4">
            <h1 class="text-lg font-semibold">Проекты</h1>
            <button
                class="rounded bg-slate-800 py-2 px-3 text-xs text-white transition hover:bg-slate-700 disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
                type="button" :disabled="loading" @click="updateProjects">
                {{ loading ? 'Загрузка...' : projects.length ? 'Обновить' : 'Загрузить проекты' }}
            </button>
        </div>

        <div v-if="projects.length" class="mb-4">
            <input v-model="search" type="search" placeholder="Поиск проектов"
                class="w-full rounded border border-white/10 bg-slate-900/40 px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-400" />
        </div>

        <p v-if="!projects.length" class="text-sm text-slate-400">Проекты еще не загружены</p>
        <p v-else-if="!filteredProjects.length" class="text-sm text-slate-400">Ничего не найдено</p>
        <div v-else class="grid gap-2">
            <article v-for="project in filteredProjects" :key="project.url"
                class="rounded-lg border border-white/10 bg-slate-900/40 p-3">
                <div class="flex items-center justify-between gap-3">
                    <h2 class="text-sm font-medium">{{ project.name || project.url }}</h2>
                    <span v-if="project.login" class="text-xs text-emerald-400">доступ есть</span>
                </div>
                <p class="mt-1 text-xs text-slate-400">{{ project.url }}</p>
            </article>
        </div>
        <p v-if="updatedAt" class="mt-4 text-xs text-slate-500">Последнее обновление: {{ formatDate(updatedAt) }}</p>
        <p v-if="message" class="mt-3 rounded bg-[#c1a100cc] p-2 text-xs text-white">{{ message }}</p>
        <details v-if="errors.length"
            class="mt-3 rounded border border-white/10 bg-slate-900/30 p-3 text-xs text-slate-300">
            <summary class="cursor-pointer">Ошибки загрузки ({{ errors.length }})</summary>
        </details>
    </section>
</template>

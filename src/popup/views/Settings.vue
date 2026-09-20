<script setup>
import { computed, onMounted, ref } from 'vue'
import { loadApiSettings, loadErrorLog, loadProjectData, refreshAccesses, refreshProjects, saveApiSettings } from '../data/projectData'

const settings = ref({ projectsUrl: '', accessUrl: '' })
const data = ref({ lastSuccessfulData: { projects: [], accesses: [], projectsUpdatedAt: null, accessesUpdatedAt: null } })
const errors = ref([])
const loading = ref('')
const message = ref('')

const successfulData = computed(() => data.value.lastSuccessfulData)

const formatDate = (value) => value ? new Date(value).toLocaleString() : ''

onMounted(async () => {
    try {
        const [savedSettings, savedData, savedErrors] = await Promise.all([
            loadApiSettings(),
            loadProjectData(),
            loadErrorLog()
        ])
        settings.value = savedSettings
        data.value = savedData
        errors.value = savedErrors
    } catch (error) {
        message.value = error.message
    }
})

const checkApi = async (type) => {
    const urlKey = type === 'projects' ? 'projectsUrl' : 'accessUrl'
    loading.value = type
    message.value = ''
    try {
        await saveApiSettings(settings.value)
        data.value = type === 'projects'
            ? await refreshProjects(settings.value[urlKey])
            : await refreshAccesses(settings.value[urlKey])
        errors.value = await loadErrorLog()
        message.value = type === 'projects'
            ? `Загружено проектов: ${data.value.lastSuccessfulData.projects.length}`
            : `Загружено доступов: ${data.value.lastSuccessfulData.accesses.length}`
    } catch (error) {
        message.value = error.message
        data.value = await loadProjectData()
        errors.value = await loadErrorLog()
    } finally {
        loading.value = ''
    }
}
</script>

<template>
    <div class="grid gap-4 w-full pt-4 px-4">
        <div class="relative">
            <input v-model="settings.projectsUrl"
                class="peer w-full bg-transparent placeholder:text-slate-400 text-slate-200 text-sm border-b border-slate-200 px-3 py-2 transition duration-300 ease focus:outline-none focus:border-slate-400 hover:border-slate-300 shadow-sm focus:shadow"
                required />
            <button
                class="absolute right-1 top-1 rounded bg-slate-800 py-1 px-2.5 border border-transparent text-center text-sm text-white transition-all shadow-sm hover:shadow focus:bg-slate-700 active:bg-slate-700 disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
                type="button" :disabled="loading === 'projects'" @click="checkApi('projects')">
                Проверить
            </button>
            <label
                class="absolute cursor-text pointer-events-none px-1 left-2.5 top-2.5 text-slate-400 text-sm transition-all transform origin-left peer-focus:-top-2 peer-focus:text-xs peer-focus:scale-90 peer-valid:-top-2 peer-valid:text-xs peer-valid:scale-90">
                API получения всех проектов
            </label>
            <p v-if="settings.projectsUrl && settings.projectsUrl === successfulData.projectsUrl && successfulData.projectsUpdatedAt"
                class="mt-2 text-xs text-emerald-400">
                Последняя успешная загрузка: {{ formatDate(successfulData.projectsUpdatedAt) }}
            </p>

            <p v-else-if="!settings.projectsUrl" class="flex items-start mt-2 text-xs text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 mr-1.5">
                    <path fill-rule="evenodd"
                        d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"
                        clip-rule="evenodd" />
                </svg>
                Общий url. Указан в таблице База знаний 5th
            </p>

            <p v-else class="mt-2 text-xs text-slate-400">Успешных загрузок по этому адресу пока не было</p>
        </div>

        <div class="relative">
            <input v-model="settings.accessUrl"
                class="peer w-full bg-transparent placeholder:text-slate-400 text-slate-200 text-sm border-b border-slate-200 px-3 py-2 transition duration-300 ease focus:outline-none focus:border-slate-400 hover:border-slate-300 shadow-sm focus:shadow"
                required />
            <button
                class="absolute right-1 top-1 rounded bg-slate-800 py-1 px-2.5 border border-transparent text-center text-sm text-white transition-all shadow-sm hover:shadow focus:bg-slate-700 active:bg-slate-700 disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
                type="button" :disabled="loading === 'access'" @click="checkApi('access')">
                Проверить
            </button>
            <label
                class="absolute cursor-text pointer-events-none px-1 left-2.5 top-2.5 text-slate-400 text-sm transition-all transform origin-left peer-focus:-top-2 peer-focus:text-xs peer-focus:scale-90 peer-valid:-top-2 peer-valid:text-xs peer-valid:scale-90">
                API получения личных доступов
            </label>
            <p v-if="settings.accessUrl && settings.accessUrl === successfulData.accessesUrl && successfulData.accessesUpdatedAt"
                class="mt-2 text-xs text-emerald-400">
                Последняя успешная загрузка: {{ formatDate(successfulData.accessesUpdatedAt) }}
            </p>


            <p v-else-if="!settings.accessUrl" class="flex items-start mt-2 text-xs text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 mr-1.5">
                    <path fill-rule="evenodd"
                        d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"
                        clip-rule="evenodd" />
                </svg>
                Успешных загрузок по этому адресу пока не было
            </p>
        </div>

        <div v-if="message" class="text-white bg-[#c1a100cc] p-2 rounded">{{ message }}</div>

        <details v-if="errors.length" class="rounded border border-white/10 bg-slate-900/30 p-3 text-xs text-slate-300">
            <summary class="cursor-pointer">Журнал ошибок ({{ errors.length }})</summary>
            <ul class="mt-2 grid gap-2">
                <li v-for="error in errors.slice(0, 10)" :key="`${error.createdAt}-${error.type}`">
                    <span class="text-slate-500">{{ formatDate(error.createdAt) }}</span>
                    {{ error.type === 'projects' ? 'Проекты' : 'Доступы' }}: {{ error.message }}
                </li>
            </ul>
        </details>
    </div>
</template>

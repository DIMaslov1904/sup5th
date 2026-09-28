<script setup>
import { computed, onMounted, ref } from 'vue'
import { clearAllData, loadApiSettings, loadErrorLog, loadProjectData, refreshAccesses, refreshProjects, saveApiSettings } from '../data/projectData'

const optionsUrl = chrome.runtime.getURL('src/options/index.html')

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
    } finally {
        loading.value = ''
    }
}

const resetData = async () => {
    if (!window.confirm('Удалить все данные расширения? Это действие нельзя отменить.')) return

    loading.value = 'reset'
    message.value = ''
    try {
        await clearAllData()
        settings.value = { projectsUrl: '', accessUrl: '' }
        data.value = { lastSuccessfulData: { projects: [], accesses: [], projectsUpdatedAt: null, accessesUpdatedAt: null, projectsUrl: '', accessesUrl: '' } }
        errors.value = []
        message.value = 'Все данные расширения удалены'
    } catch (error) {
        message.value = error.message
    } finally {
        loading.value = ''
    }
}
</script>

<template>
    <div class="grid gap-5 w-full px-4">
        <label>
            <span class="block mb-1 text-base text-white">API получения всех проектов</span>
            <div class="flex gap-1">
                <input v-model="settings.projectsUrl" type="text" placeholder="Поиск проектов"
                class="w-full rounded border border-white/10 bg-slate-900/40 px-3 py-2 text-sm text-white outline-none focus:border-slate-400" :disabled="loading === 'projects'"  />
                <button class="flex py-2 px-6  rounded border border-white/10 bg-slate-800 text-sm text-white hover:bg-slate-700 cursor-pointer disabled:pointer-events-none"
                type="button" :disabled="loading === 'projects'" @click="checkApi('projects')">
                Загрузить
            </button>
            </div>

            <p class="flex items-start mt-2 text-xs text-slate-400">
                Общий url. Указан в таблице База знаний 5th
            </p>
        </label>

        <label>
            <span class="block mb-1 text-base text-white">API получения личных доступов</span>
            <div class="flex gap-1">
                <input v-model="settings.accessUrl" type="text" placeholder="Поиск проектов"
                class="w-full rounded border border-white/10 bg-slate-900/40 px-3 py-2 text-sm text-white outline-none focus:border-slate-400" :disabled="loading === 'access'" />
                <button class="flex py-2 px-6  rounded border border-white/10 bg-slate-800 text-sm text-white hover:bg-slate-700 cursor-pointer disabled:pointer-events-none"
                type="button" :disabled="loading === 'access'" @click="checkApi('access')">
                Загрузить
            </button>
            </div>

            <p class="flex items-start mt-2 text-xs text-slate-400">
                Инструкция по получению - <a :href="optionsUrl" target="_blank" rel="noreferrer" class="hover:text-sky-300 text-white/70 underline decoration-sky-300/40 underline-offset-2">инструкция</a>
            </p>
        </label>


        <div v-if="message" class="text-white bg-[#c1a100cc] p-2 rounded">{{message}}</div>

        <details v-if="errors.length" class="rounded border border-white/10 bg-slate-900/30 p-3 text-xs text-slate-300">
            <summary class="cursor-pointer">Журнал ошибок ({{ errors.length }})</summary>
            <ul class="mt-2 grid gap-2">
                <li v-for="error in errors.slice(0, 10)" :key="`${error.createdAt}-${error.type}`">
                    <span class="text-slate-500">{{ formatDate(error.createdAt) }}</span>
                    {{ error.type === 'projects' ? 'Проекты' : 'Доступы' }}: {{error.message }}
                </li>
            </ul>
        </details>

        <button
            class="rounded border border-red-400/40 px-3 py-2 text-xs mt-8 text-red-300 transition hover:bg-red-400/10 disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
            type="button" :disabled="loading.length" @click="resetData">
            Сбросить все данные
        </button>
    </div>
</template>

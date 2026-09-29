<script setup>
import { computed, onMounted, ref } from 'vue'
import { clearAllData, loadApiSettings, loadErrorLog, loadProjectData, refreshAccesses, refreshProjects, saveApiSettings } from '../data/projectData'
import Button from '../components/ui/Button.vue'
import Input from '../components/ui/Input.vue'
import Card from '../components/ui/Card.vue'
import Message from '../components/ui/Message.vue'

const optionsUrl = chrome.runtime.getURL('src/options/index.html')

const settings = ref({ projectsUrl: '', accessUrl: '' })
const data = ref({ lastSuccessfulData: { projects: [], accesses: [], projectsUpdatedAt: null, accessesUpdatedAt: null } })
const errors = ref([])
const loading = ref('')
const message = ref({ type: 'error', text: '' })

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
        message.value = { type: 'error', text: error.message }
    }
})

const checkApi = async (type) => {
    const urlKey = type === 'projects' ? 'projectsUrl' : 'accessUrl'
    loading.value = type
    message.value = { type: 'error', text: '' }
    try {
        await saveApiSettings(settings.value)
        data.value = type === 'projects'
            ? await refreshProjects(settings.value[urlKey])
            : await refreshAccesses(settings.value[urlKey])
        errors.value = await loadErrorLog()
        message.value = {
            type: 'success',
            text: type === 'projects'
                ? `Загружено проектов: ${data.value.lastSuccessfulData.projects.length}`
                : `Загружено доступов: ${data.value.lastSuccessfulData.accesses.length}`
        }
    } catch (error) {
        message.value = { type: 'error', text: error.message }
    } finally {
        loading.value = ''
    }
}

const resetData = async () => {
    if (!window.confirm('Удалить все данные расширения? Это действие нельзя отменить.')) return

    loading.value = 'reset'
    message.value = { type: 'error', text: '' }
    try {
        await clearAllData()
        settings.value = { projectsUrl: '', accessUrl: '' }
        data.value = { lastSuccessfulData: { projects: [], accesses: [], projectsUpdatedAt: null, accessesUpdatedAt: null, projectsUrl: '', accessesUrl: '' } }
        errors.value = []
        message.value = { type: 'success', text: 'Все данные расширения удалены' }
    } catch (error) {
        message.value = { type: 'error', text: error.message }
    } finally {
        loading.value = ''
    }
}
</script>

<template>
    <div class="grid gap-5 w-full px-4">
        <Card title="API получения всех проектов">
            <div class="flex gap-1">
                <Input v-model="settings.projectsUrl" placeholder="URL веб-приложения Apps Script"
                    :disabled="loading === 'projects'" />
                <Button variant="secondary" :disabled="loading === 'projects'" @click="checkApi('projects')">
                    {{ loading === 'projects' ? 'Загрузка...' : 'Загрузить' }}
                </Button>
            </div>
            <p class="flex items-start mt-2 text-xs text-slate-400">
                Общий url. Указан в таблице База знаний 5th
            </p>
        </Card>

        <Card title="API получения личных доступов">
            <div class="flex gap-1">
                <Input v-model="settings.accessUrl" placeholder="URL веб-приложения Apps Script"
                    :disabled="loading === 'access'" />
                <Button variant="secondary" :disabled="loading === 'access'" @click="checkApi('access')">
                    {{ loading === 'access' ? 'Загрузка...' : 'Загрузить' }}
                </Button>
            </div>
            <p class="flex items-start mt-2 text-xs text-slate-400">
                Инструкция по получению -
                <a :href="optionsUrl" target="_blank" rel="noreferrer"
                    class="hover:text-sky-300 text-white/70 underline decoration-sky-300/40 underline-offset-2">инструкция</a>
            </p>
        </Card>

        <Message v-if="message.text" :type="message.type">{{ message.text }}</Message>

        <details v-if="errors.length" class="rounded border border-white/10 bg-slate-900/30 p-3 text-xs text-slate-300">
            <summary class="cursor-pointer">Журнал ошибок ({{ errors.length }})</summary>
            <ul class="mt-2 grid gap-2">
                <li v-for="error in errors.slice(0, 10)" :key="`${error.createdAt}-${error.type}`">
                    <span class="text-slate-500">{{ formatDate(error.createdAt) }}</span>
                    {{ error.type === 'projects' ? 'Проекты' : 'Доступы' }}: {{ error.message }}
                </li>
            </ul>
        </details>

        <Button variant="danger" size="sm" class="mt-8 justify-self-start" :disabled="loading.length" @click="resetData">
            Сбросить все данные
        </Button>
    </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { getProjectAccessField, getProjectAccessText, loadErrorLog, loadProjectData, loadProjectDetails } from '../data/projectData'
import { ensureUnlocked } from '../unlockStore'
import switcher from '../../utils/switcher'
import { getAdminUrl, getCmsIconPath } from '../../utils/projectUtils'
import Button from '../components/ui/Button.vue'
import Input from '../components/ui/Input.vue'
import Message from '../components/ui/Message.vue'

const projects = ref([])
const detailAccesses = ref([])
const updatedAt = ref(null)
const search = ref('')
const detailLoading = ref(false)
const message = ref({ type: 'error', text: '' })
const errors = ref([])
const selectedProjectUrl = ref('')
const copying = ref('')

// Варианты запроса с учётом исправления раскладки клавиатуры
// (например, "ghbdtn" -> "привет", "руддщ" -> "hello")
const searchVariants = computed(() => {
    const query = search.value.trim().toLowerCase()
    if (!query) return []
    const ru = switcher(query)
    const en = ru === query ? switcher(query, { type: 'rueng' }) : ''
    return [...new Set([query, ru, en].filter(Boolean))]
})

const filteredProjects = computed(() => {
    const variants = searchVariants.value
    if (!variants.length) return projects.value
    return projects.value.filter((project) => {
        const haystack = `${project.name} ${project.url}`.toLowerCase()
        return variants.some((variant) => haystack.includes(variant))
    })
})

const formatDate = (value) => value ? new Date(value).toLocaleString() : ''

const applyData = (data) => {
    projects.value = data.lastSuccessfulData.projects
    updatedAt.value = Math.max(
        data.lastSuccessfulData.projectsUpdatedAt || 0,
        data.lastSuccessfulData.accessesUpdatedAt || 0
    ) || null
}

const selectedProject = computed(() => projects.value.find((project) => project.url === selectedProjectUrl.value) || null)
const selectedProjectAccesses = computed(() => detailAccesses.value)
const ftpAccesses = computed(() => detailAccesses.value
    .map((access, sourceIndex) => ({ ...access, sourceIndex }))
    .filter((access) => access.hasFtp))

const linkHref = (value) => {
    if (!value) return ''
    return /^https?:\/\//i.test(value) ? value : `https://${value}`
}

const projectLinks = computed(() => {
    const project = selectedProject.value
    if (!project) return []
    return [
        ['Админка', project.urlAdmin || getAdminUrl(project)],
        ['Инструкция', project.manual],
        ['Git', project.git],
        ['Figma', project.figma],
        ['Дополнительный документ', project.addDocument]
    ]
})

const copyAccess = async (project, index) => {
    try {
        const text = await ensureUnlocked(() => getProjectAccessText(project.url, index))
        await navigator.clipboard.writeText(text)
        message.value = { type: 'success', text: 'Доступ скопирован' }
    } catch (error) {
        message.value = { type: 'error', text: error.message || 'Не удалось скопировать доступ' }
    }
}

const copyFtpField = async (index, field) => {
    copying.value = `ftp:${index}:${field}`
    try {
        const value = await ensureUnlocked(() => getProjectAccessField(selectedProject.value.url, index, field))
        await navigator.clipboard.writeText(value)
        message.value = { type: 'success', text: field === 'ftpLogin' ? 'FTP логин скопирован' : 'FTP пароль скопирован' }
    } catch (error) {
        message.value = { type: 'error', text: error.message }
    } finally {
        copying.value = ''
    }
}

const openProjectDetails = async (project) => {
    selectedProjectUrl.value = project.url
    detailAccesses.value = []
    detailLoading.value = true
    message.value = { type: 'error', text: '' }
    try {
        const details = await loadProjectDetails(project.url)
        detailAccesses.value = details.accesses
    } catch (error) {
        message.value = { type: 'error', text: error.message }
    } finally {
        detailLoading.value = false
    }
}

onMounted(async () => {
    try {
        const [data, savedErrors] = await Promise.all([
            loadProjectData(),
            loadErrorLog()
        ])
        applyData(data)
        errors.value = savedErrors
    } catch (error) {
        message.value = { type: 'error', text: error.message }
    }
})
</script>

<template>
    <section class="w-full px-4 text-slate-200">
        <div v-if="selectedProject" class="flex items-center justify-between gap-3 mb-4">
            <div class="flex items-center gap-2">
                <Button variant="ghost" size="sm" aria-label="Назад к списку" title="Назад к списку"
                    @click="selectedProjectUrl = ''">←</Button>
                <h1 class="text-lg font-semibold">{{ selectedProject?.name }}</h1>
            </div>
        </div>

        <div v-if="projects.length && !selectedProject" class="mb-4">
            <Input v-model="search" type="search" placeholder="Поиск проектов" />
        </div>

        <p v-if="!projects.length && !selectedProject" class="text-sm text-slate-400">Проекты еще не загружены</p>
        <p v-else-if="!selectedProject && !filteredProjects.length" class="text-sm text-slate-400">Ничего не найдено</p>
        <div v-else-if="!selectedProject" class="grid gap-2">
            <article v-for="project in filteredProjects" :key="project.url"
                class="relative rounded-lg border border-white/10 bg-slate-900/40 py-3 pl-5 pr-3 overflow-hidden">
                <span v-if="project.hasAccess" class="absolute -left-1 -top-1 h-3 w-3 rounded-full bg-blue-400" role="img" aria-label="Доступ есть"></span>
                <button type="button" :aria-label="`Открыть детали проекта ${project.name || project.url}`"
                    class="flex w-full items-start gap-1.5 text-left cursor-pointer" @click="openProjectDetails(project)">
                    <span class="text-sm font-medium leading-snug text-slate-100">{{ project.name || project.url }}</span>
                </button>
                <a :href="`https://${project.url}`" target="_blank" rel="noreferrer" title="Перейти на сайт"
                    :aria-label="`Перейти на сайт ${project.url}`"
                    class="mt-1 inline-flex items-center gap-1 break-all text-sm text-sky-300 hover:text-sky-200">
                    <span>{{ project.url }}</span><span aria-hidden="true">↗</span>
                </a>
            </article>
        </div>
        <div v-else-if="selectedProject" class="grid gap-4">
            <div class="flex items-center justify-between gap-3">
                <div class="min-w-0">
                    <p class="break-all text-sm text-slate-300">{{ selectedProject.url }}</p>
                    <p class="mt-1 text-xs text-slate-500">CMS: {{ selectedProject.cms || 'Нет' }}</p>
                </div>
                <a :href="`https://${selectedProject.url}`" target="_blank" rel="noreferrer" title="Перейти на сайт"
                    class="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-white/10 text-lg text-slate-200 hover:bg-white/10">↗</a>
            </div>

            <dl class="grid gap-2 rounded-lg border border-white/10 bg-slate-900/40 p-3 text-xs">
                <div class="flex justify-between gap-3"><dt class="text-slate-400">Домен</dt><dd class="text-right">{{ selectedProject.url }}</dd></div>
                <div class="flex justify-between gap-3"><dt class="text-slate-400">Поддомены</dt><dd>{{ selectedProject.subdomain ? 'Разрешены' : 'Не разрешены' }}</dd></div>
                <div class="flex justify-between gap-3"><dt class="text-slate-400">CMS</dt><dd>
                    <img v-if="getCmsIconPath(selectedProject.cms)" :src="getCmsIconPath(selectedProject.cms)" :alt="selectedProject.cms"
                        :title="selectedProject.cms" class="h-3 w-3 inline-block rounded bg-white object-contain p-px" />
                    {{ selectedProject.cms || 'Нет' }}</dd></div>
                <div v-for="field in projectLinks" :key="field[0]" class="flex justify-between gap-3">
                    <dt class="text-slate-400">{{ field[0] }}</dt>
                    <dd v-if="field[1]" class="text-right"><a :href="linkHref(field[1])" target="_blank" rel="noreferrer" class="text-sky-300 underline decoration-sky-300/40 underline-offset-2 hover:text-sky-200">Перейти ↗</a></dd>
                    <dd v-else class="text-right text-slate-500">Нет</dd>
                </div>
            </dl>

            <section class="grid gap-2">
                <h2 class="text-sm font-semibold">Доступы ({{ selectedProjectAccesses.length }})</h2>
                <p v-if="detailLoading" class="text-xs text-slate-400">Загрузка доступов...</p>
                <p v-else-if="!selectedProjectAccesses.length" class="text-xs text-slate-400">Для проекта нет сохранённых доступов</p>
                <article v-for="(access, index) in selectedProjectAccesses" :key="`${access.login}-${index}`"
                    class="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-slate-900/40 p-3">
                    <span class="min-w-0 break-all text-xs text-slate-300">{{ access.login || `Доступ ${index + 1}` }}</span>
                    <Button v-if="access.hasLogin && access.hasPassword" variant="secondary" size="sm"
                        @click="copyAccess(selectedProject, index)">Скопировать доступ</Button>
                    <span v-else class="text-[11px] text-amber-300">Логин или пароль не заполнен</span>
                </article>
            </section>

            <section v-if="ftpAccesses.length" class="grid gap-2">
                <h2 class="text-sm font-semibold">FTP доступы ({{ ftpAccesses.length }})</h2>
                <article v-for="(access, index) in ftpAccesses" :key="`ftp-${access.ftpUrl}-${index}`"
                    class="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-slate-900/40 p-3">
                    <span class="min-w-0 break-all text-xs text-slate-300">{{ access.ftpUrl }}</span>
                    <div class="flex shrink-0 gap-2">
                        <Button variant="ghost" size="sm" :disabled="copying === `ftp:${access.sourceIndex}:ftpLogin`"
                            @click="copyFtpField(access.sourceIndex, 'ftpLogin')">Логин</Button>
                        <Button variant="ghost" size="sm" :disabled="copying === `ftp:${access.sourceIndex}:ftpPassword`"
                            @click="copyFtpField(access.sourceIndex, 'ftpPassword')">Пароль</Button>
                    </div>
                </article>
            </section>
        </div>
        <p v-if="updatedAt" class="mt-4 text-xs text-slate-500">Последнее обновление: {{ formatDate(updatedAt) }}</p>
        <Message v-if="message.text" :type="message.type">{{ message.text }}</Message>
        <details v-if="errors.length"
            class="mt-3 rounded border border-white/10 bg-slate-900/30 p-3 text-xs text-slate-300">
            <summary class="cursor-pointer">Ошибки загрузки ({{ errors.length }})</summary>
        </details>
    </section>
</template>

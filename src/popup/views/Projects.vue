<script setup>
import { computed, onMounted, ref } from 'vue'
import { getProjectAccessField, getProjectAccessText, getServiceField, loadServices, loadProjectData, loadProjectDetails } from '../data/projectData'
import { ensureUnlocked } from '../unlockStore'
import { searchCatalogue } from '../../utils/catalogue.js'
import FtpAccessCard from '../components/FtpAccessCard.vue'
import { getAdminUrl, getCmsIconPath, getTicketUrl } from '../../utils/projectUtils'
import Button from '../components/ui/Button.vue'
import Input from '../components/ui/Input.vue'
import Message from '../components/ui/Message.vue'

const projects = ref([])
const services = ref([])
const detailAccesses = ref([])
const updatedAt = ref(null)
const search = ref('')
const detailLoading = ref(false)
const message = ref({ type: 'error', text: '' })
const selectedProjectUrl = defineModel('selectedProjectUrl', { type: String, default: '' })
const selectedServiceId = defineModel('selectedServiceId', { type: String, default: '' })
const selectedService = computed(() => services.value.find(item => item.id === selectedServiceId.value) || null)
const selectedItem = computed(() => selectedService.value || selectedProject.value)
const openItem = (item) => {
    if (item.kind === 'service') { selectedProjectUrl.value = ''; selectedServiceId.value = item.id; message.value.text = '' }
    else { selectedServiceId.value = ''; openProjectDetails(item) }
}
const copyService = async (field) => {
    copying.value = field
    try {
        const value = await ensureUnlocked(() => getServiceField(selectedService.value.id, field))
        services.value = await loadServices()
        await navigator.clipboard.writeText(value)
        message.value = { type: 'success', text: (field === 'login' ? 'Логин' : 'Пароль') + ' скопирован' }
    } catch (error) { message.value = { type: 'error', text: error.message } }
    finally { copying.value = '' }
}
const copying = ref('')
const openAccessMenuId = ref('')

const filteredProjects = computed(() => searchCatalogue(services.value, projects.value, search.value))

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
        ['Админка', getAdminUrl(project)],
        ['Инструкция', project.manual],
        ['Git', project.git],
        ['Дополнительный документ', project.addDocument]
    ]
})

const copyAccess = async (project, index, field, label) => {
    copying.value = `access:${index}:${field}`
    try {
        const value = await ensureUnlocked(() => field === 'text' ?  getProjectAccessText(project.url, index) : getProjectAccessField(project.url, index, field))
        await navigator.clipboard.writeText(value)
        message.value = { type: 'success', text: `${label} скопирован` }
    } catch (error) {
        message.value = { type: 'error', text: error.message || `Не удалось скопировать ${label.toLowerCase()}` }
    } finally {
        copying.value = ''
        openAccessMenuId.value = ''
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
        const [data, savedServices] = await Promise.all([
            loadProjectData(),
            loadServices()
        ])
        services.value = savedServices
        if (!savedServices.some(item => item.id === selectedServiceId.value)) selectedServiceId.value = ''
        applyData(data)
        if (selectedProjectUrl.value) {
            const project = projects.value.find((item) => item.url === selectedProjectUrl.value)
            if (project) await openProjectDetails(project)
            else selectedProjectUrl.value = ''
        }
    } catch (error) {
        message.value = { type: 'error', text: error.message }
    }
})
</script>

<template>
    <section class="w-full px-4 text-slate-200">
        <div v-if="selectedItem" class="flex items-center justify-between gap-3 mb-4">
            <div class="flex items-center gap-2">
                <Button variant="ghost" size="sm" aria-label="Назад к списку" title="Назад к списку"
                    @click="selectedProjectUrl = ''; selectedServiceId = ''">←</Button>
                <h1 class="text-lg font-semibold">{{ selectedItem?.name }}</h1>
            </div>
        </div>

        <div v-if="(projects.length || services.length) && !selectedItem" class="mb-4">
            <Input v-model="search" type="search" placeholder="Поиск сервисов и проектов" />
        </div>

        <p v-if="!projects.length && !services.length && !selectedItem" class="text-sm text-slate-400">Проекты и сервисы ещё не загружены</p>
        <p v-else-if="!selectedItem && !filteredProjects.length" class="text-sm text-slate-400">Ничего не найдено</p>
        <div v-else-if="!selectedItem" class="grid gap-2">
            <article v-for="project in filteredProjects" :key="project.key"
                class="relative rounded-lg border border-white/10 bg-slate-900/40 py-3 pl-5 pr-3 overflow-hidden">
                <span v-if="project.hasAccess || project.hasLogin || project.hasPassword" class="absolute -left-1 -top-1 h-3 w-3 rounded-full bg-blue-400" role="img" aria-label="Доступ есть"></span>
                <button type="button" :aria-label="`Открыть детали ${project.kind === 'service' ? 'сервиса' : 'проекта'} ${project.name || project.url}`"
                    class="flex w-full items-start gap-1.5 text-left cursor-pointer" @click="openItem(project)">
                    <span class="text-sm font-medium leading-snug text-slate-100">{{ project.name || project.url }}</span>
                </button>
                <a :href="linkHref(project.url)" target="_blank" rel="noreferrer" title="Перейти на сайт"
                    :aria-label="`Перейти на сайт ${project.url}`"
                    class="mt-1 inline-flex items-center gap-1 break-all text-sm text-sky-300 hover:text-sky-200">
                    <span>{{ project.url }}</span><span aria-hidden="true">↗</span>
                </a>
            </article>
        </div>
        <div v-else-if="selectedService" class="grid gap-4">
            <p class="text-xs text-slate-500">Сервис</p>
            <a :href="linkHref(selectedService.url)" target="_blank" rel="noreferrer" class="break-all text-sm text-sky-300">{{ selectedService.url }} ↗</a>
            <article class="grid gap-3 rounded-lg border border-white/10 bg-slate-900/40 p-3">
                <h2 class="text-sm font-semibold">Доступ</h2>
                <p class="break-all text-xs text-slate-300">Логин: {{ selectedService.login || (selectedService.hasLogin ? 'Доступен после первой разблокировки' : 'Не указан') }}</p>
                <div class="flex flex-wrap gap-2">
                    <Button v-if="selectedService.hasLogin || selectedService.login" variant="ghost" size="sm" :disabled="Boolean(copying)" @click="copyService('login')">Скопировать логин</Button>
                    <Button v-if="selectedService.hasPassword || selectedService.password" variant="ghost" size="sm" :disabled="Boolean(copying)" @click="copyService('password')">Скопировать пароль</Button>
                </div>
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

            <a v-if="getTicketUrl(selectedProject)" :href="getTicketUrl(selectedProject)" target="_blank" rel="noreferrer"
                class="text-sm text-sky-300 underline decoration-sky-300/40 underline-offset-2 hover:text-sky-200">Создать тикет</a>

            <section class="grid gap-2">
                <h2 class="text-sm font-semibold">Доступы ({{ selectedProjectAccesses.length }})</h2>
                <p v-if="detailLoading" class="text-xs text-slate-400">Загрузка доступов...</p>
                <p v-else-if="!selectedProjectAccesses.length" class="text-xs text-slate-400">Для проекта нет сохранённых доступов</p>
                <article v-for="(access, index) in selectedProjectAccesses" :key="`${access.login}-${index}`"
                    class="relative flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-slate-900/40 p-3">
                    <span class="min-w-0 break-all text-xs text-slate-300">{{ access.login || `Доступ ${index + 1}` }}</span>
                    <template v-if="access.hasLogin && access.hasPassword">
                        <button type="button" title="Действия с доступом" :aria-label="`Действия: ${access.login || index + 1}`"
                            @click.stop="openAccessMenuId = openAccessMenuId === `${access.login}-menu` ? '' : `${access.login}-menu`"
                            class="rounded px-2 py-1 text-lg leading-none text-slate-400 hover:bg-white/10 hover:text-white cursor-pointer">
                            ⋮
                        </button>
                        <div v-if="openAccessMenuId == `${access.login}-menu`"
                            class="absolute right-2 top-11 z-20 grid min-w-40 gap-1 rounded border border-white/10 bg-slate-800 p-1 shadow-lg">
                            <button type="button" class="rounded px-3 py-2 text-left text-xs hover:bg-white/10 cursor-pointer"
                                @click="copyAccess(selectedProject, index, 'login', 'Логин')">
                                Скопировать логин
                            </button>
                            <button type="button" class="rounded px-3 py-2 text-left text-xs hover:bg-white/10 cursor-pointer"
                                @click="copyAccess(selectedProject, index, 'password', 'Пароль')">
                                Скопировать пароль
                            </button>
                            <button type="button" class="rounded px-3 py-2 text-left text-xs hover:bg-white/10 cursor-pointer"
                                @click="copyAccess(selectedProject, index, 'text', 'Доступ')">
                                Скопировать доступ
                            </button>
                        </div>
                    </template>
                    <span v-else class="text-[11px] text-amber-300">Логин или пароль не заполнен</span>
                </article>
            </section>

            <section v-if="ftpAccesses.length" class="grid gap-2">
                <h2 class="text-sm font-semibold">FTP доступы ({{ ftpAccesses.length }})</h2>
                <FtpAccessCard v-for="access in ftpAccesses" :key="access.sourceIndex" :access="access" :project-url="selectedProject.url" :index="access.sourceIndex" />
            </section>
        </div>
        <p v-if="updatedAt" class="mt-4 text-xs text-slate-500">Последнее обновление: {{ formatDate(updatedAt) }}</p>
        <Message v-if="message.text" :type="message.type">{{ message.text }}</Message>
    </section>
</template>

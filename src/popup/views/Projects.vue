<script setup>
import { computed, onMounted, ref } from 'vue'
import { getProjectAccessText, loadErrorLog, loadProjectData, loadProjectDetails } from '../data/projectData'

const projects = ref([])
const detailAccesses = ref([])
const updatedAt = ref(null)
const search = ref('')
const detailLoading = ref(false)
const message = ref('')
const errors = ref([])
const selectedProjectUrl = ref('')

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

const selectedProject = computed(() => projects.value.find((project) => project.url === selectedProjectUrl.value) || null)
const selectedProjectAccesses = computed(() => detailAccesses.value)

const getCmsIcon = (cms) => {
    if (!cms || cms === 'Нет') return ''
    const iconName = cms === 'Своя' ? 'cms' : cms.toLowerCase()
    const icons = ['abo', 'adminlte', 'bitrix', 'cms', 'ezpro', 'joomla', 'modx', 'tilda', 'umi', 'wordpress']
    return `/assets/icons/${icons.includes(iconName) ? iconName : 'cms'}.svg`
}

const linkHref = (value) => {
    if (!value) return ''
    return /^https?:\/\//i.test(value) ? value : `https://${value}`
}

const adminUrl = (project) => {
    if (!project) return ''
    const paths = { UMI: 'admin/content/sitetree/', EzPro: 'ezpro/', Bitrix: 'bitrix/admin/#authorize', ABO: 'login.php', MODX: 'manager/', AdminLTE: 'admin/', Joomla: 'administrator/' }
    if (project.cms === 'Tilda') return 'https://tilda.ru/login/'
    if (project.cms === 'Своя' || project.cms === 'WordPress') return project.urlAdmin ? `https://${project.urlAdmin}` : ''
    return paths[project.cms] ? `https://${project.url}/${paths[project.cms]}` : project.urlAdmin ? `https://${project.urlAdmin}` : ''
}

const projectLinks = computed(() => {
    const project = selectedProject.value
    if (!project) return []
    return [
        ['Админка', project.urlAdmin || adminUrl(project)],
        ['Инструкция', project.manual],
        ['Git', project.git],
        ['Figma', project.figma],
        ['Дополнительный документ', project.addDocument]
    ]
})

const copyAccess = async (project, index) => {
    try {
        const text = await getProjectAccessText(project.url, index)
        await navigator.clipboard.writeText(text)
        message.value = 'Доступ скопирован'
    } catch (error) {
        message.value = error.message || 'Не удалось скопировать доступ'
    }
}

const openProjectDetails = async (project) => {
    selectedProjectUrl.value = project.url
    detailAccesses.value = []
    detailLoading.value = true
    message.value = ''
    try {
        const details = await loadProjectDetails(project.url)
        detailAccesses.value = details.accesses
    } catch (error) {
        message.value = error.message
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
        message.value = error.message
    }
})

</script>

<template>
    <section class="w-full px-4 text-slate-200">
        <div v-if="selectedProject" class="flex items-center justify-between gap-3 mb-4">
            <div class="flex items-center gap-2">
                <button  type="button" title="Назад к списку" aria-label="Назад списку"
                    class="rounded px-2 py-1 text-slate-300 hover:bg-white/10" @click="selectedProjectUrl = ''">←</button>
                <h1 class="text-lg font-semibold">{{ selectedProject?.name }}</h1>
            </div>
        </div>

        <div v-if="projects.length && !selectedProject" class="mb-4">
            <input v-model="search" type="search" placeholder="Поиск проектов"
                class="w-full rounded border border-white/10 bg-slate-900/40 px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-400" />
        </div>

        <p v-if="!projects.length && !selectedProject" class="text-sm text-slate-400">Проекты еще не загружены</p>
        <p v-else-if="!selectedProject && !filteredProjects.length" class="text-sm text-slate-400">Ничего не найдено</p>
        <div v-else-if="!selectedProject" class="grid gap-2">
            <article v-for="project in filteredProjects" :key="project.url"
                class="relative rounded-lg border border-white/10 bg-slate-900/40 py-3 pl-5 pr-3 overflow-hidden">
                <span v-if="project.hasAccess" class="absolute -left-1 -top-1 h-3 w-3 rounded-full bg-blue-400" role="img" aria-label="Доступ есть"></span>
                <button type="button" :aria-label="`Открыть детали проекта ${project.name || project.url}`"
                    class="flex w-full items-start gap-1.5 text-left" @click="openProjectDetails(project)">
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
                        <img v-if="getCmsIcon(selectedProject.cms)" :src="getCmsIcon(selectedProject.cms)" :alt="selectedProject.cms"
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
                    <button v-if="access.hasLogin && access.hasPassword" type="button"
                        class="shrink-0 rounded bg-slate-800 px-3 py-2 text-xs text-white hover:bg-slate-700"
                        @click="copyAccess(selectedProject, index)">Скопировать доступ</button>
                    <span v-else class="text-[11px] text-amber-300">Логин или пароль не заполнен</span>
                </article>
            </section>
        </div>
        <p v-if="updatedAt" class="mt-4 text-xs text-slate-500">Последнее обновление: {{ formatDate(updatedAt) }}</p>
        <p v-if="message" class="mt-3 rounded bg-[#c1a100cc] p-2 text-xs text-white">{{ message }}</p>
        <details v-if="errors.length"
            class="mt-3 rounded border border-white/10 bg-slate-900/30 p-3 text-xs text-slate-300">
            <summary class="cursor-pointer">Ошибки загрузки ({{ errors.length }})</summary>
        </details>
    </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { getServiceField, loadServices, loadProjectData } from '../data/projectData'
import { ensureUnlocked } from '../unlockStore'
import { searchCatalogue } from '../../utils/catalogue.js'
import { displayUrl } from '../../utils/displayUrl.js'
import SiteIcon from '../components/SiteIcon.vue'
import ProjectDetails from '../components/ProjectDetails.vue'
import Button from '../components/ui/Button.vue'
import Message from '../components/ui/Message.vue'

const projects = ref([]), services = ref([]), copying = ref('')
const search = defineModel('search', { type: String, default: '' })
const message = ref({ type: 'error', text: '' })
const selectedProjectUrl = defineModel('selectedProjectUrl', { type: String, default: '' })
const selectedServiceId = defineModel('selectedServiceId', { type: String, default: '' })
const selectedService = computed(() => services.value.find(item => item.id === selectedServiceId.value) || null)
const selectedProject = computed(() => projects.value.find(item => item.url === selectedProjectUrl.value) || null)
const selectedItem = computed(() => selectedService.value || selectedProject.value)
const filteredProjects = computed(() => searchCatalogue(services.value, projects.value, search.value))
const linkHref = value => value ? (/^https?:\/\//i.test(value) ? value : `https://${value}`) : ''
const back = () => { selectedProjectUrl.value = ''; selectedServiceId.value = ''; message.value.text = '' }
const openItem = item => {
    message.value.text = ''
    if (item.kind === 'service') { selectedProjectUrl.value = ''; selectedServiceId.value = item.id }
    else { selectedServiceId.value = ''; selectedProjectUrl.value = item.url }
}
const copyService = async field => {
    copying.value = field
    try {
        const value = await ensureUnlocked(() => getServiceField(selectedService.value.id, field))
        services.value = await loadServices()
        await navigator.clipboard.writeText(value)
        message.value = { type: 'success', text: (field === 'login' ? 'Логин' : 'Пароль') + ' скопирован' }
    } catch (reason) { message.value = { type: 'error', text: reason.message } }
    finally { copying.value = '' }
}
onMounted(async () => {
    try {
        const [data, savedServices] = await Promise.all([loadProjectData(), loadServices()])
        services.value = savedServices
        projects.value = data.lastSuccessfulData.projects
        if (!savedServices.some(item => item.id === selectedServiceId.value)) selectedServiceId.value = ''
        if (!projects.value.some(item => item.url === selectedProjectUrl.value)) selectedProjectUrl.value = ''
    } catch (reason) { message.value = { type: 'error', text: reason.message } }
})
</script>
<template>
    <section class="w-full px-4 text-slate-200">
        <p v-if="!projects.length && !services.length && !selectedItem" class="text-sm text-slate-400">Проекты и сервисы ещё не загружены</p>
        <p v-else-if="!selectedItem && !filteredProjects.length" class="text-sm text-slate-400">Ничего не найдено</p>
        <div v-else-if="!selectedItem" class="grid gap-2">
            <article v-for="project in filteredProjects" :key="project.key" @click="openItem(project)" :aria-label="`Открыть детали ${project.kind === 'service' ? 'сервиса' : 'проекта'} ${project.name || project.url}`"
                class="relative rounded-lg border border-white/10 bg-slate-900/40 py-3 pl-14 pr-12 overflow-hidden cursor-pointer">
                <SiteIcon :url="project.url" :name="project.name" class="absolute left-3 top-3" />
                <span v-if="project.hasAccess || project.hasLogin || project.hasPassword" class="absolute -left-1 -top-1 h-3 w-3 rounded-full bg-blue-400" role="img" aria-label="Доступ есть"></span>
                <span class="text-sm font-medium leading-snug text-slate-100">{{ project.name || displayUrl(project.url) }}</span>
                <span class="mt-1 text-sm text-sky-300 line-clamp-1">{{ displayUrl(project.url) }}</span>
                <a :href="linkHref(project.url)" target="_blank" rel="noreferrer" title="Перейти на сайт" @click.stop class="absolute top-3 right-3 inline-flex items-center justify-center gap-1.5 rounded font-medium transition cursor-pointer select-none px-2.5 py-1.5 text-xs border border-white/10 text-slate-200 hover:bg-white/10 hover:text-sky-200">↗</a>
            </article>
        </div>
        <div v-else-if="selectedService" class="grid gap-4">
            <div class="flex items-center gap-2">
                <Button variant="ghost" size="sm" aria-label="Назад к списку" title="Назад к списку" @click="back">←</Button>
                <SiteIcon :url="selectedService.url" :name="selectedService.name" />
                <h1 class="text-lg font-semibold">{{ selectedService.name }}</h1>
            </div>
            <a :href="linkHref(selectedService.url)" target="_blank" rel="noreferrer" class="break-all text-sm text-sky-300">{{ displayUrl(selectedService.url) }} ↗</a>
            <article class="grid gap-3 rounded-lg border border-white/10 bg-slate-900/40 p-3">
                <h2 class="text-sm font-semibold">Доступ</h2>
                <p class="break-all text-xs text-slate-300">Логин: {{ selectedService.login || (selectedService.hasLogin ? 'Доступен после первой разблокировки' : 'Не указан') }}</p>
                <div class="flex flex-wrap gap-2">
                    <Button v-if="selectedService.hasLogin || selectedService.login" variant="ghost" size="sm" :disabled="Boolean(copying)" @click="copyService('login')">Скопировать логин</Button>
                    <Button v-if="selectedService.hasPassword || selectedService.password" variant="ghost" size="sm" :disabled="Boolean(copying)" @click="copyService('password')">Скопировать пароль</Button>
                </div>
            </article>
        </div>
        <ProjectDetails v-else-if="selectedProject" :key="selectedProject.url" :project="selectedProject">
            <template #leading><Button variant="ghost" size="sm" aria-label="Назад к списку" title="Назад к списку" @click="back">←</Button></template>
        </ProjectDetails>
        <Message v-if="message.text" :type="message.type" class="mt-3">{{ message.text }}</Message>
    </section>
</template>

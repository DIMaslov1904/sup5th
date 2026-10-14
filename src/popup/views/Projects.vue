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
import EmptyState from '../components/ui/EmptyState.vue'

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
    <section class="min-w-0 w-full px-4 text-ui-text">
        <EmptyState v-if="!projects.length && !services.length && !selectedItem" title="Проекты и сервисы ещё не загружены" description="Укажите адреса API и загрузите данные в настройках." />
        <EmptyState v-else-if="!selectedItem && !filteredProjects.length" title="Ничего не найдено" description="Попробуйте другое название или адрес сайта." />
        <div v-else-if="!selectedItem" class="grid min-w-0 grid-cols-1 gap-2">
            <article v-for="project in filteredProjects" :key="project.key" @click="openItem(project)" :aria-label="`Открыть детали ${project.kind === 'service' ? 'сервиса' : 'проекта'} ${project.name || project.url}`"
                class="ui-panel relative grid w-full cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 transition-colors hover:border-ui-accent/40 hover:bg-ui-raised">
                <SiteIcon :url="project.url" :name="project.name" />

                <div class="min-w-0">
                    <span v-if="project.hasAccess || project.hasLogin || project.hasPassword" class="absolute -left-1 -top-1 h-3 w-3 rounded-full bg-ui-accent" role="img" aria-label="Доступ есть"></span>
                    <span :title="project.name || displayUrl(project.url)" class="line-clamp-2 wrap-anywhere text-[13px] font-medium leading-snug text-ui-text">{{ project.name || displayUrl(project.url) }}</span>
                    <span :title="displayUrl(project.url)" class="mt-1 block truncate text-xs text-ui-accent">{{ displayUrl(project.url) }}</span>
                </div>

                <Button :href="linkHref(project.url)" size="sm" variant="ghost" title="Перейти на сайт" :aria-label="`Перейти на сайт ${displayUrl(project.url)}`" @click.stop class="size-8 p-0">↗</Button>

            </article>
        </div>
        <div v-else-if="selectedService" class="grid gap-4">
            <div class="flex min-w-0 items-center gap-2">
                <Button variant="ghost" size="sm" aria-label="Назад к списку" title="Назад к списку" @click="back">←</Button>
                <SiteIcon :url="selectedService.url" :name="selectedService.name" />
                <h1 :title="selectedService.name" class="ui-title min-w-0 line-clamp-2 wrap-anywhere">{{ selectedService.name }}</h1>
            </div>
            <a :href="linkHref(selectedService.url)" :title="displayUrl(selectedService.url)" target="_blank" rel="noreferrer" class="min-w-0 truncate text-[13px] text-ui-accent">{{ displayUrl(selectedService.url) }} ↗</a>
            <article class="grid gap-3 ui-panel">
                <h2 class="text-[13px] font-semibold">Доступ</h2>
                <p class="break-all text-xs text-ui-muted">Логин: {{ selectedService.login || (selectedService.hasLogin ? 'Доступен после первой разблокировки' : 'Не указан') }}</p>
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

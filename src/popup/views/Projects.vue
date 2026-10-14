<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { getServiceField, loadServices, loadProjectData, loadApiSettings } from '../data/projectData'
import { ensureUnlocked } from '../unlockStore'
import { searchCatalogue } from '../../utils/catalogue.js'
import { displayUrl } from '../../utils/displayUrl.js'
import { siteHref } from '../../utils/siteAddress.js'
import { refreshJob } from '../backgroundState.js'
import Preloader from '../components/ui/Preloader.vue'
import SiteIcon from '../components/SiteIcon.vue'
import ProjectDetails from '../components/ProjectDetails.vue'
import Button from '../components/ui/Button.vue'
import Message from '../components/ui/Message.vue'
import EmptyState from '../components/ui/EmptyState.vue'

const projects = ref([]), services = ref([]), copying = ref(''), loaded = ref(false), connected = ref(false)
let alive = true, revision = 0
const downloaded = ref(false), loadError = ref('')
const search = defineModel('search', { type: String, default: '' })
const message = ref({ type: 'error', text: '' })
const selectedProjectUrl = defineModel('selectedProjectUrl', { type: String, default: '' })
const selectedServiceId = defineModel('selectedServiceId', { type: String, default: '' })
const selectedService = computed(() => services.value.find(item => item.id === selectedServiceId.value) || null)
const selectedProject = computed(() => projects.value.find(item => item.url === selectedProjectUrl.value) || null)
const selectedItem = computed(() => selectedService.value || selectedProject.value)
const filteredProjects = computed(() => searchCatalogue(services.value, projects.value, search.value))
const linkHref = siteHref
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
const load = async () => {
    const current = ++revision
    try {
        const [data, savedServices, settings] = await Promise.all([loadProjectData(), loadServices(), loadApiSettings()])
        if (!alive || current !== revision) return
        connected.value = Boolean(settings.projectsUrl || settings.accessUrl)
        downloaded.value = Boolean(data.lastSuccessfulData.projectsUpdatedAt || data.lastSuccessfulData.accessesUpdatedAt)
        loadError.value = ''
        services.value = savedServices
        projects.value = data.lastSuccessfulData.projects
        if (!savedServices.some(item => item.id === selectedServiceId.value)) selectedServiceId.value = ''
        if (!projects.value.some(item => item.url === selectedProjectUrl.value)) selectedProjectUrl.value = ''
    } catch (reason) { if (alive) loadError.value = reason.message }
    finally { if (alive) loaded.value = true }
}
const changed = (changes, area) => { if (area === 'local' && (changes.projectData || changes.services || changes.apiSettings)) load() }
onMounted(() => { chrome.storage.onChanged.addListener(changed); load() })
onUnmounted(() => { alive = false; revision++; chrome.storage.onChanged.removeListener(changed) })
</script>
<template>
    <section class="min-w-0 w-full px-4 text-ui-text">
        <Preloader v-if="!loaded || (refreshJob.running && !projects.length && !services.length)" label="Загрузка каталога…" />
        <Message v-else-if="loadError" type="error">{{ loadError }}</Message>
        <EmptyState v-else-if="!connected && !projects.length && !services.length" title="Данные ещё не подключены" description="Добавьте адреса API в настройках." />
        <EmptyState v-else-if="!downloaded && !projects.length && !services.length" title="Данные ещё не загружены" description="API подключён. Запустите первую загрузку в настройках." />
        <EmptyState v-else-if="!projects.length && !services.length && !selectedItem" title="Каталог пуст" description="Загрузите данные в настройках. Если загрузка выполнена, проверьте содержимое источника." />
        <EmptyState v-else-if="!selectedItem && !filteredProjects.length" title="Ничего не найдено" description="Попробуйте другое название или адрес сайта." />
        <div v-else-if="!selectedItem" class="grid min-w-0 grid-cols-1 gap-2">
            <article v-for="project in filteredProjects" :key="project.key" role="button" tabindex="0" @click="openItem(project)" @keydown.enter.self.prevent="openItem(project)" @keydown.space.self.prevent="openItem(project)" :aria-label="`Открыть детали ${project.kind === 'service' ? 'сервиса' : 'проекта'} ${project.name || project.url}`"
                class="ui-panel relative grid w-full cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 transition-colors hover:border-ui-accent/40 hover:bg-ui-raised">
                <SiteIcon :url="project.siteUrl || project.url" :name="project.name" />

                <div class="min-w-0">
                    <div class="flex min-w-0 items-start gap-1.5">
                        <span :title="project.name || displayUrl(project.url)" class="min-w-0 line-clamp-2 wrap-anywhere text-[13px] font-medium leading-snug text-ui-text">{{ project.name || displayUrl(project.url) }}</span>
                        <svg v-if="project.hasAccess || project.hasLogin || project.hasPassword" class="mt-0.5 size-3.5 shrink-0 text-ui-muted"  fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Доступ сохранён">
                            <path d="M14 17c-.536 0-1.484-.502-2.602 0-.405.182-1.3 1.073-2.201 1.963C8.319 19.83 7.436 20.695 7 20.9l-3.5-.4-.4-3.5c.414-.884 3.54-3.598 3.9-4.398.503-1.118 0-2.066 0-2.602a7 7 0 1 1 7 7m-4.803 1.963L7.234 17"/>
                            <circle cx="14" cy="10" r="2"/>
                        </svg>
                    </div>
                    <span :title="displayUrl(project.url)" class="mt-1 block truncate text-xs text-ui-accent">{{ displayUrl(project.url) }}</span>
                </div>

                <Button :href="linkHref(project.siteUrl || project.url)" size="sm" variant="ghost" title="Перейти на сайт" :aria-label="`Перейти на сайт ${displayUrl(project.url)}`" @click.stop class="size-8 p-0">↗</Button>

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

<script setup>
import { computed, defineAsyncComponent, onMounted, ref } from 'vue'
import { getProjectAccessField, loadProjectData, loadProjectDetails, startAdminAuth } from '../data/projectData'
import { findProjectByUrl, getAdminUrl, getCmsIconPath, getTicketUrl } from '../../utils/projectUtils'
import { ensureUnlocked } from '../unlockStore'
import Button from '../components/ui/Button.vue'
import Message from '../components/ui/Message.vue'
import LeftMenu from '../components/LeftMenu.vue'
const SeoPanel = defineAsyncComponent(() => import('../components/SeoPanel.vue'))
import FtpAccessCard from '../components/FtpAccessCard.vue'

const menuItem = ref('project')

const project = ref(null)
const currentTab = ref(null)
const loaded = ref(false)
const authLoading = ref(false)
const authMessage = ref('')
const accesses = ref([])
const copyingAccess = ref('')

const ftpAccesses = computed(() => accesses.value
    .map((access, sourceIndex) => ({ ...access, sourceIndex }))
    .filter((access) => access.hasFtp))
const getInstructionUrl = (item) => item?.manual ? `https://${item.manual}` : ''
const getGitUrl = (item) => item?.git ? `https://${item.git}` : ''
const getCmsIcon = (item) => getCmsIconPath(item?.cms)
const siteUrl = computed(() => project.value ? `https://${project.value.url}` : '')
const faviconUrl = computed(() => currentTab.value?.favIconUrl || (siteUrl.value ? `${siteUrl.value}/favicon.ico` : ''))
const cmsLabel = computed(() => project.value?.cms && project.value.cms !== 'Нет' ? project.value.cms : 'CMS')
const menuList = computed(() => {
    if (!project.value) return [{ label: 'SEO', name: 'seo' }]
    return [
        { label: 'Проект', name: 'project' },
        { label: 'SEO', name: 'seo' }
    ]
})

onMounted(async () => {
    try {
        const [tab, data] = await Promise.all([
            new Promise((resolve) => chrome.tabs.query({ active: true, currentWindow: true }, ([activeTab]) => resolve(activeTab))),
            loadProjectData()
        ])
        currentTab.value = tab
        const projects = data.lastSuccessfulData?.projects || []
        if (tab?.url && /^https?:/.test(tab.url)) project.value = findProjectByUrl(projects, tab.url)
        if (!project.value) {
            menuItem.value = 'seo'
            return
        }

        const details = await loadProjectDetails(project.value.url)
        accesses.value = details.accesses
    } finally {
        loaded.value = true
    }
})

const openAdmin = async (accessIndex = 0) => {
    authLoading.value = true
    authMessage.value = ''
    try {
        await ensureUnlocked(() => startAdminAuth(project.value.url, accessIndex))
    } catch (error) {
        authMessage.value = error.message
    } finally {
        authLoading.value = false
    }
}

const copyAccessField = async (accessIndex, field) => {
    copyingAccess.value = `${accessIndex}:${field}`
    authMessage.value = ''
    try {
        const value = await ensureUnlocked(() => getProjectAccessField(project.value.url, accessIndex, field))
        await navigator.clipboard.writeText(value)
        authMessage.value = field === 'login' ? 'Логин скопирован'
            : field.startsWith('ftp') ? 'FTP данные скопированы' : 'Пароль скопирован'
    } catch (error) {
        authMessage.value = error.message
    } finally {
        copyingAccess.value = ''
    }
}
</script>

<template>
    <div class="relative min-h-full w-full">
        <LeftMenu v-model="menuItem" :menuList="menuList" />

        <section v-if="menuItem === 'project'" class="pl-8 pr-4 text-slate-200">
            <p v-if="!loaded" class="text-sm text-slate-400">Загрузка...</p>
            <p v-else-if="!project" class="text-sm text-slate-400">Текущий сайт не найден среди проектов</p>
            <div v-else class="grid gap-4">
                <div class="flex items-center gap-3">
                    <img v-if="faviconUrl" :src="faviconUrl" :alt="project.name"
                        class="h-12 w-12 rounded-lg bg-white object-contain p-1" />
                    <div class="min-w-0">
                        <div class="flex items-center gap-2">
                            <img :src="getCmsIcon(project)" :alt="cmsLabel" :title="cmsLabel"
                                class="h-5 w-5 shrink-0 rounded bg-white p-0.5 object-contain" />
                            <h1 class="text-lg font-semibold">{{ project.name || project.url }}</h1>
                        </div>
                        <a :href="siteUrl" target="_blank" rel="noreferrer"
                            class="break-all text-xs text-slate-400 hover:text-white">{{ project.url }}</a>
                    </div>
                </div>

                <div class="grid grid-cols-3 gap-2">
                    <a :href="getAdminUrl(project)" target="_blank" rel="noreferrer"
                        :class="getAdminUrl(project) ? 'hover:bg-slate-700' : 'pointer-events-none opacity-40'"
                        title="Перейти в панель администрирования"
                        class="flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg border border-white/10 bg-slate-900/50 p-2 text-center text-xs text-slate-200">
                        <span class="flex h-8 w-8 items-center justify-center rounded bg-white p-1">
                            <img :src="getCmsIcon(project)" :alt="cmsLabel" class="h-full w-full object-contain" />
                        </span>
                        <span>В админку</span>
                    </a>
                    <a :href="getInstructionUrl(project)" target="_blank" rel="noreferrer"
                        :class="getInstructionUrl(project) ? 'hover:bg-slate-700' : 'pointer-events-none opacity-40'"
                        class="flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg border border-white/10 bg-slate-900/50 p-2 text-center text-xs text-slate-200">
                        <span class="text-lg">?</span>
                        <span>Инструкция</span>
                    </a>
                    <a :href="getGitUrl(project)" target="_blank" rel="noreferrer"
                        :class="getGitUrl(project) ? 'hover:bg-slate-700' : 'pointer-events-none opacity-40'"
                        class="flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg border border-white/10 bg-slate-900/50 p-2 text-center text-xs text-slate-200">
                        <span class="text-lg">Git</span>
                        <span>Репозиторий</span>
                    </a>
                </div>
                <a v-if="getTicketUrl(project)" :href="getTicketUrl(project)" target="_blank" rel="noreferrer"
                    class="text-sm text-sky-300 underline decoration-sky-300/40 underline-offset-2 hover:text-sky-200">Создать тикет</a>

                <section v-if="accesses.length" class="grid gap-2">
                    <h2 class="text-sm font-semibold">Доступы ({{ accesses.length }})</h2>
                    <article v-for="(access, index) in accesses" :key="`${access.login}-${index}`"
                        class="grid gap-3 rounded-lg border border-white/10 bg-slate-900/40 p-3"
                        :class="!access.hasLogin || !access.hasPassword ? 'opacity-75' : ''">
                        <div class="flex items-center justify-between gap-2">
                            <span class="min-w-0 break-all text-sm font-medium text-slate-100">{{ access.login || access.name || `Доступ ${index + 1}` }}</span>
                            <button v-if="access.hasLogin && access.hasPassword" type="button"
                                :disabled="authLoading" :title="`Войти как ${access.login}`"
                                aria-label="Войти в админку под этим доступом"
                                class="shrink-0 rounded bg-sky-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-600 disabled:opacity-50 cursor-pointer"
                                @click="openAdmin(index)">
                                {{ authLoading ? 'Вход...' : 'Войти' }}
                            </button>
                        </div>
                        <div class="flex flex-wrap gap-2">
                            <Button v-if="access.hasLogin" variant="ghost" size="sm" :disabled="copyingAccess === `${index}:login`"
                                @click="copyAccessField(index, 'login')">{{ copyingAccess === `${index}:login` ? 'Копирую...' : 'Копировать логин' }}</Button>
                            <Button v-if="access.hasPassword" variant="ghost" size="sm" :disabled="copyingAccess === `${index}:password`"
                                @click="copyAccessField(index, 'password')">{{ copyingAccess === `${index}:password` ? 'Копирую...' : 'Копировать пароль' }}</Button>
                            <span v-if="!access.hasLogin || !access.hasPassword" class="self-center text-[11px] text-amber-300">
                                {{ !access.hasLogin ? 'Логин не указан' : 'Пароль не указан' }}
                            </span>
                        </div>
                    </article>
                </section>
                <section v-if="ftpAccesses.length" class="grid gap-2">
                    <h2 class="text-sm font-semibold">FTP доступы ({{ ftpAccesses.length }})</h2>
                    <FtpAccessCard v-for="access in ftpAccesses" :key="access.sourceIndex" :access="access" :project-url="project.url" :index="access.sourceIndex" />
                </section>
                <Message v-if="authMessage" type="error">{{ authMessage }}</Message>
            </div>
        </section>

        <section v-else-if="menuItem === 'seo' && loaded" class="pl-8 pr-4"><SeoPanel :tab="currentTab" /></section>
    </div>
</template>

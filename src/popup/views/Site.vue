<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { getProjectAccessField, loadProjectData, loadProjectDetails, startAdminAuth } from '../data/projectData'
import LeftMenu from '../components/LeftMenu.vue'

const menuItem = ref('project')

const project = ref(null)
const currentTab = ref(null)
const loaded = ref(false)
const authLoading = ref(false)
const authMessage = ref('')
const accesses = ref([])
const copyingAccess = ref('')
const seo = ref(null)
const seoLoading = ref(false)
const seoMessage = ref('')

const normalizeHost = (value) => {
    try {
        return new URL(value).hostname.toLowerCase()
    } catch {
        return String(value || '').replace(/^https?:\/\//, '').split('/')[0].toLowerCase()
    }
}

const getInstructionUrl = (item) => item?.manual ? `https://${item.manual}` : ''
const getGitUrl = (item) => item?.git ? `https://${item.git}` : ''
const getCmsIcon = (item) => {
    const iconName = item?.cms === 'Своя' ? 'cms' : String(item?.cms || '').toLowerCase()
    return ['/assets/icons/abo.svg', '/assets/icons/adminlte.svg', '/assets/icons/bitrix.svg', '/assets/icons/cms.svg', '/assets/icons/ezpro.svg', '/assets/icons/joomla.svg', '/assets/icons/modx.svg', '/assets/icons/tilda.svg', '/assets/icons/umi.svg', '/assets/icons/wordpress.svg'].includes(`/assets/icons/${iconName}.svg`)
        ? `/assets/icons/${iconName}.svg`
        : '/assets/icons/cms.svg'
}
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

const findProject = (projects, tab) => {
    const host = normalizeHost(tab.url)
    return projects.find((item) => {
        if (!item.url) return false
        const projectHost = normalizeHost(item.url)
        return item.subdomain ? (host === projectHost || host.endsWith(`.${projectHost}`)) : host === projectHost
    }) || null
}

onMounted(async () => {
    try {
        const [tab, data] = await Promise.all([
            new Promise((resolve) => chrome.tabs.query({ active: true, currentWindow: true }, ([activeTab]) => resolve(activeTab))),
            loadProjectData()
        ])
        currentTab.value = tab
        const projects = data.lastSuccessfulData?.projects || []
        if (tab?.url && /^https?:/.test(tab.url)) project.value = findProject(projects, tab)
        if (!project.value) {
            menuItem.value = 'seo'
            return
        }

        const siteStateKey = `siteUiState:${normalizeHost(tab.url)}`
        const savedState = (await chrome.storage.local.get(siteStateKey))[siteStateKey]
        const details = await loadProjectDetails(project.value.url)
        accesses.value = details.accesses
        const allowedTabs = menuList.value.map((item) => item.name)
        menuItem.value = allowedTabs.includes(savedState?.tab) ? savedState.tab : 'project'
    } finally {
        loaded.value = true
    }
})

watch(menuItem, (tab) => {
    if (!currentTab.value?.url || !project.value) return
    const key = `siteUiState:${normalizeHost(currentTab.value.url)}`
    chrome.storage.local.set({ [key]: { tab } })
})

const scanSeo = async () => {
    if (!currentTab.value?.id) return
    seoLoading.value = true
    seoMessage.value = ''
    try {
        seo.value = await new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(currentTab.value.id, { type: 'seo:scan' }, (response) => {
                const error = chrome.runtime.lastError
                if (error) reject(new Error('SEO-анализ недоступен. Обновите открытую страницу и повторите проверку.'))
                else if (!response?.ok) reject(new Error(response?.error || 'Не удалось получить SEO-данные'))
                else resolve(response.data)
            })
        })
    } catch (error) {
        seoMessage.value = error.message
    } finally {
        seoLoading.value = false
    }
}

watch(menuItem, (value) => {
    if (value === 'seo') scanSeo()
})

const openAdmin = async (accessIndex = 0) => {
    authLoading.value = true
    authMessage.value = ''
    try {
        const key = `siteUiState:${normalizeHost(currentTab.value.url)}`
        await chrome.storage.local.set({ [key]: { tab: 'project' } })
        await startAdminAuth(project.value.url, accessIndex)
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
        const value = await getProjectAccessField(project.value.url, accessIndex, field)
        await navigator.clipboard.writeText(value)
        authMessage.value = field === 'login' ? 'Логин скопирован' : 'Пароль скопирован'
    } catch (error) {
        authMessage.value = error.message
    } finally {
        copyingAccess.value = ''
    }
}
</script>

<template>
    <div class="relative min-h-full w-full pt-4">
        <LeftMenu v-model="menuItem" :menuList="menuList" />

        <section v-if="menuItem === 'project'" class="px-4 pt-5 text-slate-200">
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
                            <h1 class="break-words text-lg font-semibold">{{ project.name || project.url }}</h1>
                        </div>
                        <a :href="siteUrl" target="_blank" rel="noreferrer"
                            class="break-all text-xs text-slate-400 hover:text-white">{{ project.url }}</a>
                    </div>
                </div>

                <div class="grid grid-cols-3 gap-2">
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
                <section v-if="accesses.length" class="grid gap-2">
                    <h2 class="text-sm font-semibold">Доступы ({{ accesses.length }})</h2>
                    <article v-for="(access, index) in accesses" :key="`${access.login}-${index}`"
                        :role="access.hasLogin && access.hasPassword ? 'button' : undefined"
                        :tabindex="access.hasLogin && access.hasPassword ? 0 : undefined"
                        :aria-label="access.hasLogin && access.hasPassword ? `Войти как ${access.login}` : undefined"
                        class="grid gap-3 rounded-lg border border-white/10 bg-slate-900/40 p-3"
                        :class="access.hasLogin && access.hasPassword ? 'cursor-pointer hover:border-white/20 hover:bg-slate-900/70' : 'opacity-75'"
                        @click="access.hasLogin && access.hasPassword && openAdmin(index)"
                        @keydown.enter="access.hasLogin && access.hasPassword && openAdmin(index)">
                        <div class="flex items-center justify-between gap-2">
                            <span class="break-all text-sm font-medium text-slate-100">{{ access.login || access.name || `Доступ ${index + 1}` }}</span>
                            <span v-if="access.hasLogin && access.hasPassword" class="shrink-0 text-[10px] text-slate-500">Войти →</span>
                        </div>
                        <div class="flex flex-wrap gap-2" @click.stop>
                            <button v-if="access.hasLogin" type="button" :disabled="copyingAccess === `${index}:login`"
                                class="rounded border border-white/10 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-white/10 disabled:opacity-50"
                                @click="copyAccessField(index, 'login')">{{ copyingAccess === `${index}:login` ? 'Копирую...' : 'Копировать логин' }}</button>
                            <button v-if="access.hasPassword" type="button" :disabled="copyingAccess === `${index}:password`"
                                class="rounded border border-white/10 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-white/10 disabled:opacity-50"
                                @click="copyAccessField(index, 'password')">{{ copyingAccess === `${index}:password` ? 'Копирую...' : 'Копировать пароль' }}</button>
                            <span v-if="!access.hasLogin || !access.hasPassword" class="self-center text-[11px] text-amber-300">
                                {{ !access.hasLogin ? 'Логин не указан' : 'Пароль не указан' }}
                            </span>
                        </div>
                    </article>
                </section>
                <p v-if="authMessage" class="rounded bg-[#c1a100cc] p-2 text-xs text-white">{{ authMessage }}</p>
            </div>
        </section>

        <section v-else-if="menuItem === 'seo'" class="px-4 pt-5 text-slate-200">
            <div class="mb-4 flex items-center justify-between gap-3">
                <div>
                    <h1 class="text-lg font-semibold">SEO</h1>
                    <p class="text-xs text-slate-400">Анализ текущей страницы без внешних сервисов</p>
                </div>
                <button type="button" @click="scanSeo" :disabled="seoLoading"
                    class="rounded bg-slate-800 px-3 py-2 text-xs text-white hover:bg-slate-700 disabled:pointer-events-none disabled:opacity-50">
                    {{ seoLoading ? 'Проверка...' : 'Проверить' }}
                </button>
            </div>

            <p v-if="seoMessage" class="rounded bg-[#c1a100cc] p-2 text-xs text-white">{{ seoMessage }}</p>
            <div v-else-if="seo" class="grid gap-3 text-xs">
                <div class="grid gap-2 rounded-lg border border-white/10 bg-slate-900/40 p-3">
                    <div class="flex justify-between gap-3"><span>Title</span><strong>{{ seo.title || 'Нет' }}</strong>
                    </div>
                    <div class="flex justify-between gap-3"><span>URL страницы</span><strong
                            class="max-w-[210px] truncate">{{ seo.url }} ({{ seo.urlLength }})</strong></div>
                    <div class="flex justify-between gap-3"><span>Длина Title</span><strong
                            :class="seo.titleLength >= 30 && seo.titleLength <= 65 ? 'text-emerald-400' : 'text-amber-300'">{{
                                seo.titleLength }}</strong></div>
                    <div class="flex justify-between gap-3"><span>Description</span><strong
                            class="max-w-[210px] text-right">{{ seo.description || 'Нет' }}</strong></div>
                    <div class="flex justify-between gap-3"><span>Keywords</span><strong
                            class="max-w-[210px] text-right">{{ seo.keywords || 'Нет' }}</strong></div>
                    <div class="flex justify-between gap-3"><span>Длина Description</span><strong
                            :class="seo.descriptionLength >= 70 && seo.descriptionLength <= 160 ? 'text-emerald-400' : 'text-amber-300'">{{
                                seo.descriptionLength }}</strong></div>
                    <div class="flex justify-between gap-3"><span>Язык</span><strong>{{ seo.lang || 'Нет' }}</strong>
                    </div>
                    <div class="flex justify-between gap-3"><span>Canonical</span><strong
                            class="max-w-[210px] truncate">{{ seo.canonical || 'Нет' }}</strong></div>
                    <div class="flex justify-between gap-3"><span>Robots</span><strong>{{ seo.robots || 'Не указан'
                    }}</strong></div>
                    <div class="flex justify-between gap-3"><span>Индексирование</span><strong
                            :class="seo.robotsAllowed && seo.xRobotsAllowed ? 'text-emerald-400' : 'text-amber-300'">{{
                                seo.robotsAllowed && seo.xRobotsAllowed ? 'Разрешено' : 'Ограничено' }}</strong></div>
                    <div class="flex justify-between gap-3"><span>X-Robots-Tag</span>
                        <strong>{{ seo.xRobots || `Не указан` }}</strong>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-2">
                    <div v-for="level in 6" :key="level" class="rounded-lg border border-white/10 bg-slate-900/40 p-3">
                        <span>H{{ level }}</span><strong class="mt-1 block text-lg">{{ seo.headings[`h${level}`].length
                            }}</strong>
                    </div>
                    <div class="rounded-lg border border-white/10 bg-slate-900/40 p-3"><span>Слов</span><strong
                            class="mt-1 block text-lg">{{ seo.wordCount }}</strong></div>
                    <div class="rounded-lg border border-white/10 bg-slate-900/40 p-3"><span>HTML</span><strong
                            class="mt-1 block text-lg">{{ Math.round(seo.htmlSize / 1024) }} КБ</strong></div>
                </div>

                <div class="grid gap-2 rounded-lg border border-white/10 bg-slate-900/40 p-3">
                    <div class="flex justify-between"><span>Изображений</span><strong>{{ seo.images.total }}</strong>
                    </div>
                    <div class="flex justify-between"><span>Без alt</span><strong
                            :class="seo.images.withoutAlt ? 'text-amber-300' : 'text-emerald-400'">{{
                                seo.images.withoutAlt }}</strong></div>
                    <div class="flex justify-between"><span>Ссылок внутренних</span><strong>{{ seo.links.internal
                    }}</strong></div>
                    <div class="flex justify-between"><span>Ссылок внешних</span><strong>{{ seo.links.external
                    }}</strong></div>
                    <div class="flex justify-between"><span>Ссылок без текста</span><strong>{{ seo.links.withoutText
                    }}</strong></div>
                </div>

                <div class="grid gap-2 rounded-lg border border-white/10 bg-slate-900/40 p-3">
                    <div class="flex justify-between"><span>Код ответа</span><strong
                            :class="seo.response.ok ? 'text-emerald-400' : 'text-amber-300'">{{ seo.response.status ||
                                'Не получен' }}</strong></div>
                    <div class="flex justify-between"><span>robots.txt</span><strong>{{ seo.robotsFile.exists ?
                        `Доступен (${seo.robotsFile.status})` : 'Отсутствует' }}</strong></div>
                    <div class="flex justify-between"><span>Индексирование по robots.txt</span><strong
                            :class="seo.robotsFile.allowed ? 'text-emerald-400' : 'text-amber-300'">{{
                                seo.robotsFile.allowed ? 'Разрешено' : 'Ограничено' }}</strong></div>
                    <div class="flex justify-between"><span>sitemap.xml</span><strong>{{ seo.sitemap.exists ? `Доступен
                            (${seo.sitemap.status})` : 'Отсутствует' }}</strong></div>
                </div>

                <details class="rounded-lg border border-white/10 bg-slate-900/40 p-3">
                    <summary class="cursor-pointer">Заголовки H1-H6</summary>
                    <div class="mt-2 grid gap-2 text-slate-400">
                        <div v-for="level in 6" :key="level"><strong class="text-slate-200">H{{ level }} ({{
                            seo.headings[`h${level}`].length }})</strong>
                            <div v-for="heading in seo.headings[`h${level}`]">{{ heading }}</div><span
                                v-if="!seo.headings[`h${level}`].length">Нет</span>
                        </div>
                    </div>
                </details>

                <details class="rounded-lg border border-white/10 bg-slate-900/40 p-3">
                    <summary class="cursor-pointer">Open Graph</summary>
                    <div class="mt-2 grid gap-1 text-slate-400">
                        <span>OG title: {{ seo.openGraph.title || 'Нет' }}</span>
                        <span>OG image: {{ seo.openGraph.image || 'Нет' }}</span>
                    </div>
                </details>

                <details v-if="seo.robotsFile.content" class="rounded-lg border border-white/10 bg-slate-900/40 p-3">
                    <summary class="cursor-pointer">Содержимое robots.txt</summary>
                    <pre
                        class="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-[11px] text-slate-400">{{ seo.robotsFile.content }}</pre>
                </details>
            </div>
        </section>

        <section v-else class="px-4 pt-5 text-sm text-slate-400">Раздел пока не реализован</section>
    </div>
</template>

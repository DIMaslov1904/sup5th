<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { getProjectAccessField, loadProjectData, loadProjectDetails, startAdminAuth } from '../data/projectData'
import { findProjectByUrl, getAdminUrl, getCmsIconPath, getTicketUrl } from '../../utils/projectUtils'
import { ensureUnlocked } from '../unlockStore'
import Button from '../components/ui/Button.vue'
import Message from '../components/ui/Message.vue'
import LeftMenu from '../components/LeftMenu.vue'

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
const seo = ref(null)
const seoLoading = ref(false)
const seoMessage = ref('')

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

const openSeoAudit = () => chrome.tabs.create({ url: chrome.runtime.getURL('src/seo/index.html') })

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
                    <article v-for="(access, index) in ftpAccesses" :key="`ftp-${access.ftpUrl}-${index}`"
                        class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-slate-900/40 p-3">
                        <div class="min-w-0">
                            <span class="break-all text-sm font-medium text-slate-100">{{ access.ftpUrl }}</span>
                            <span v-if="access.ftpHasLogin" class="block text-xs text-slate-400">
                                Логин: {{ access.ftpLogin || '…' }}
                            </span>
                        </div>
                        <div class="flex shrink-0 gap-2">
                            <Button v-if="access.ftpHasLogin" variant="ghost" size="sm"
                                :disabled="copyingAccess === `ftp:${access.sourceIndex}:ftpLogin`"
                                @click="copyAccessField(access.sourceIndex, 'ftpLogin')">FTP логин</Button>
                            <Button v-if="access.ftpHasPassword" variant="ghost" size="sm"
                                :disabled="copyingAccess === `ftp:${access.sourceIndex}:ftpPassword`"
                                @click="copyAccessField(access.sourceIndex, 'ftpPassword')">FTP пароль</Button>
                        </div>
                    </article>
                </section>
                <Message v-if="authMessage" type="error">{{ authMessage }}</Message>
            </div>
        </section>

        <section v-else-if="menuItem === 'seo'" class="pl-8 pr-4 text-slate-200">
            <div class="mb-4 flex items-center justify-between gap-3">
                <div>
                    <h1 class="text-lg font-semibold">SEO</h1>
                    <p class="text-xs text-slate-400">Анализ текущей страницы без внешних сервисов</p>
                </div>
                <div class="flex shrink-0 gap-2">
                    <Button variant="secondary" size="sm" @click="openSeoAudit">Расширенный аудит</Button>
                    <Button variant="secondary" size="sm" :disabled="seoLoading" @click="scanSeo">
                        {{ seoLoading ? 'Проверка...' : 'Проверить' }}
                    </Button>
                </div>
            </div>

            <Message v-if="seoMessage" type="error">{{ seoMessage }}</Message>
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
                    <div class="flex justify-between gap-3"><span>Генератор (CMS)</span><strong
                            class="max-w-[210px] truncate">{{ seo.generator || 'Не определён' }}</strong></div>
                    <div class="flex justify-between gap-3"><span>Заголовков H1</span><strong
                            :class="seo.h1Count === 1 ? 'text-emerald-400' : 'text-amber-300'">{{ seo.h1Count }}</strong></div>
                    <div v-if="seo.duplicateH1?.length" class="flex justify-between gap-3"><span>Дубли H1</span><strong
                            class="text-amber-300">{{ seo.duplicateH1.length }}</strong></div>
                    <div class="flex justify-between gap-3"><span>JSON-LD разметка</span><strong>{{ seo.jsonLdBlocks
                        }}</strong></div>
                    <div class="flex justify-between gap-3"><span>Редирект</span><strong
                            :class="seo.redirected ? 'text-amber-300' : 'text-emerald-400'">{{ seo.redirected ? 'Есть' : 'Нет' }}</strong></div>
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

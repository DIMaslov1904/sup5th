<script setup>
import { computed, ref } from 'vue'
import Button from '../popup/components/ui/Button.vue'
import Card from '../popup/components/ui/Card.vue'
import Message from '../popup/components/ui/Message.vue'

const state = ref('idle') // idle | scanning | checking-links | done | error
const progress = ref({ current: 0, total: 0 })
const message = ref('')
const report = ref(null)          // базовый отчёт по текущей странице
const checks = ref([])            // чек-лист [{label, ok, hint}]
const linkChecks = ref([])        // [{url, status, ok, redirected, ttfb}]
const duplicateTitles = ref([])
const duplicateDescriptions = ref([])
const sitemapInfo = ref(null)     // {url, exists, count, containsCurrent, duplicates}
const robotsRules = ref([])       // [{directive, value, applies, blocked}]

const score = computed(() => {
    const passed = checks.value.filter((item) => item.ok).length
    const total = checks.value.length
    return { passed, total, percent: total ? Math.round((passed / total) * 100) : 0 }
})

const sendToBackground = (type, payload) => new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, payload }, (response) => {
        const error = chrome.runtime.lastError
        if (error) return reject(new Error(error.message))
        if (!response?.ok) return reject(new Error(response?.error || 'Неизвестная ошибка'))
        resolve(response.data)
    })
})

const sendToTab = (tabId, type) => new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { type }, (response) => {
        const error = chrome.runtime.lastError
        if (error) return reject(new Error('Content script недоступен. Обновите страницу и повторите.'))
        if (!response?.ok) return reject(new Error(response?.error || 'Не удалось получить данные'))
        resolve(response.data)
    })
})

const fetchBg = (url, method = 'GET') => sendToBackground('seo:fetch', { url, method })

// Активная вкладка с сайтом (страница расширения сама по себе не считается)
const getActiveSiteTab = async () => {
    const tabs = await chrome.tabs.query({})
    const activeSites = tabs.filter((tab) => tab.active && tab.url && /^https?:/.test(tab.url))
    if (activeSites.length) return activeSites[activeSites.length - 1]
    const anySites = tabs.filter((tab) => tab.url && /^https?:/.test(tab.url))
    return anySites[anySites.length - 1] || null
}

const parseTitle = (text) => text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || ''
const parseDescription = (text) => {
    const match = text.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)
        || text.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i)
    return match?.[1]?.trim() || ''
}
const stripHtml = (text) => text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
const stripQuery = (url) => {
    try {
        const u = new URL(url)
        u.search = ''
        u.hash = ''
        return u.href
    } catch {
        return url
    }
}

const parseSitemapLocations = (text) => [...text.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((match) => match[1].trim())

const checkRobotsForPath = (content, pathname) => {
    const rules = []
    let currentGroup = null
    for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim()
        if (!line || line.startsWith('#')) continue
        const colonIndex = line.indexOf(':')
        if (colonIndex < 0) continue
        const directive = line.slice(0, colonIndex).trim().toLowerCase()
        const value = line.slice(colonIndex + 1).trim()
        if (directive === 'user-agent') {
            currentGroup = value
            continue
        }
        if (!['allow', 'disallow'].includes(directive)) continue
        const pattern = value.replace(/[*$]/g, '').replace(/\/$/, '')
        const applies = !pattern || pathname.startsWith(pattern)
        if (currentGroup === '*' && applies) {
            rules.push({ directive, value, blocked: directive === 'disallow' })
        }
    }
    return rules
}

const runAudit = async () => {
    message.value = ''
    state.value = 'scanning'
    checks.value = []
    linkChecks.value = []
    duplicateTitles.value = []
    duplicateDescriptions.value = []
    sitemapInfo.value = null
    robotsRules.value = []

    try {
        const tab = await getActiveSiteTab()
        if (!tab?.id || !tab?.url || !/^https?:/.test(tab.url)) {
            throw new Error('Откройте проверяемый сайт в активной вкладке')
        }
        const data = await sendToTab(tab.id, 'seo:scan')
        report.value = data

        const linkList = [...new Set([data.url, ...(data.internalLinks || [])].map(stripQuery))].slice(0, 60)
        progress.value = { current: 0, total: linkList.length }
        state.value = 'checking-links'

        // Проверка ссылок батчами по 5 параллельно
        const BATCH = 5
        const results = []
        for (let i = 0; i < linkList.length; i += BATCH) {
            const batch = linkList.slice(i, i + BATCH)
            const batchResults = await Promise.all(batch.map(async (url) => {
                let info = await fetchBg(url, 'HEAD')
                if (!info.ok) info = await fetchBg(url)
                let title = ''
                let description = ''
                if (info.ok && info.text) {
                    title = parseTitle(info.text)
                    description = parseDescription(info.text)
                }
                return { url, status: info.status, ok: info.ok, redirected: Boolean(info.url && info.url !== url), ttfb: info.ttfb, title, description }
            }))
            results.push(...batchResults)
            progress.value = { current: results.length, total: linkList.length }
        }
        linkChecks.value = results

        // Дубли title/description среди страниц с валидным HTML
        const withMeta = results.filter((item) => item.title || item.description)
        const titleCounts = new Map()
        const descCounts = new Map()
        for (const item of withMeta) {
            if (item.title) titleCounts.set(item.title, (titleCounts.get(item.title) || 0) + 1)
            if (item.description) descCounts.set(item.description, (descCounts.get(item.description) || 0) + 1)
        }
        duplicateTitles.value = [...titleCounts.entries()].filter(([, count]) => count > 1)
        duplicateDescriptions.value = [...descCounts.entries()].filter(([, count]) => count > 1)

        // Sitemap
        const sitemapUrl = data.sitemap.url
        const sitemapRes = await fetchBg(sitemapUrl)
        const locations = sitemapRes.ok ? parseSitemapLocations(sitemapRes.text) : []
        const strippedLocations = locations.map(stripQuery)
        sitemapInfo.value = {
            url: sitemapUrl,
            exists: sitemapRes.ok,
            status: sitemapRes.status,
            count: locations.length,
            containsCurrent: strippedLocations.includes(stripQuery(data.url)),
            duplicates: locations.length - new Set(strippedLocations).size
        }

        // robots.txt правила для текущего пути
        const pathname = new URL(data.url).pathname
        robotsRules.value = checkRobotsForPath(data.robotsFile.content || '', pathname)

        buildChecks(data, results)
        state.value = 'done'
    } catch (error) {
        message.value = error.message
        state.value = 'error'
    }
}

const buildChecks = (data, results) => {
    const linksOk = results.filter((item) => item.ok && item.status >= 200 && item.status < 400)
    const brokenCount = results.length - linksOk.length
    const slowPages = results.filter((item) => item.ttfb != null && item.ttfb > 500).length

    const list = [
        { label: 'Title заполнен', ok: Boolean(data.title), hint: data.title || '—' },
        { label: 'Длина Title 30–65 символов', ok: data.titleLength >= 30 && data.titleLength <= 65, hint: `${data.titleLength}` },
        { label: 'Title содержит кириллицу', ok: data.titleHasCyrillic },
        { label: 'Description заполнен', ok: Boolean(data.description), hint: data.description || '—' },
        { label: 'Длина Description 70–160 символов', ok: data.descriptionLength >= 70 && data.descriptionLength <= 160, hint: `${data.descriptionLength}` },
        { label: 'Description содержит кириллицу', ok: data.descriptionHasCyrillic },
        { label: 'Ровно один H1', ok: data.h1Count === 1, hint: `H1: ${data.h1Count}` },
        { label: 'Нет дублей H1', ok: !data.duplicateH1?.length },
        { label: 'Указан Canonical', ok: Boolean(data.canonical) },
        { label: 'Индексация разрешена (robots)', ok: data.robotsAllowed },
        { label: 'X-Robots-Tag не запрещает', ok: data.xRobotsAllowed },
        { label: 'Указан lang', ok: Boolean(data.lang) },
        { label: 'Указан Viewport', ok: data.viewport },
        { label: 'Есть Favicon', ok: Boolean(data.favicon) },
        { label: 'Есть JSON-LD разметка', ok: data.jsonLdBlocks > 0 },
        { label: 'Нет ссылок без текста', ok: data.links.withoutText === 0, hint: `${data.links.withoutText}` },
        { label: 'Все изображения имеют alt', ok: data.images.withoutAlt === 0 && data.images.emptyAlt === 0, hint: `без alt: ${data.images.withoutAlt}` },
        { label: 'Нет редиректов', ok: !data.redirected },
        { label: 'TTFB до 500 мс', ok: data.response.ttfb == null || data.response.ttfb < 500, hint: data.response.ttfb != null ? `${data.response.ttfb} мс` : 'не измерен' },
        { label: 'robots.txt доступен', ok: data.robotsFile.exists, hint: data.robotsFile.status ? `HTTP ${data.robotsFile.status}` : '—' },
        { label: 'sitemap.xml доступен', ok: data.sitemap.exists, hint: data.sitemap.status ? `HTTP ${data.sitemap.status}` : '—' },
        { label: 'Текущая страница в sitemap', ok: sitemapInfo.value?.containsCurrent === true },
        { label: 'Нет битых внутренних ссылок', ok: brokenCount === 0, hint: `${brokenCount} из ${results.length}` },
        { label: 'Медленных страниц нет (>500 мс)', ok: slowPages === 0, hint: `${slowPages}` },
        { label: 'Нет дублей Title на страницах', ok: duplicateTitles.value.length === 0, hint: `${duplicateTitles.value.length}` },
        { label: 'Нет дублей Description на страницах', ok: duplicateDescriptions.value.length === 0, hint: `${duplicateDescriptions.value.length}` }
    ]
    checks.value = list
}

const openTab = (url) => chrome.tabs.create({ url })
</script>

<template>
    <div class="min-h-screen w-full bg-linear-[135deg,#0f172a,0%,#1e293b,30%,#334155,60%,#1e293b] text-slate-200">
        <div class="mx-auto flex max-w-4xl flex-col gap-4 px-5 py-6">
            <header class="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 class="text-2xl font-bold">SEO-аудит</h1>
                    <p class="text-xs text-slate-400">Расширенная проверка текущей страницы и внутренних ссылок</p>
                </div>
                <Button variant="primary" size="md" :disabled="state === 'scanning' || state === 'checking-links'"
                    @click="runAudit">
                    {{ state === 'idle' || state === 'error' ? 'Запустить аудит' : state === 'scanning' ? 'Сканируем страницу...' : 'Проверяем ссылки...' }}
                </Button>
            </header>

            <Message v-if="message" type="error">{{ message }}</Message>

            <div v-if="state === 'checking-links'" class="rounded-lg border border-white/10 bg-slate-900/40 p-3 text-xs">
                Проверено страниц: {{ progress.current }} из {{ progress.total }}
                <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                    <div class="h-full bg-sky-600 transition-all" :style="{ width: `${progress.total ? Math.round(progress.current / progress.total * 100) : 0}%` }"></div>
                </div>
            </div>

            <template v-if="state === 'done'">
                <Card class="!p-5">
                    <div class="flex items-center gap-6">
                        <div class="relative grid h-24 w-24 place-items-center rounded-full border-4"
                            :class="score.percent >= 80 ? 'border-emerald-500' : score.percent >= 50 ? 'border-amber-400' : 'border-red-400'">
                            <span class="text-2xl font-bold">{{ score.percent }}%</span>
                        </div>
                        <div>
                            <p class="text-lg font-semibold">{{ score.passed }} из {{ score.total }} проверок пройдено</p>
                            <p v-if="report" class="mt-1 break-all text-xs text-slate-400">
                                <a :href="report.url" target="_blank" rel="noreferrer" class="text-sky-300 hover:text-sky-200">{{ report.url }}</a>
                                <span v-if="report.generator" class="ml-2">CMS: {{ report.generator }}</span>
                            </p>
                        </div>
                    </div>
                </Card>

                <Card title="Чек-лист">
                    <ul class="grid gap-1.5">
                        <li v-for="(item, index) in checks" :key="index"
                            class="flex items-start justify-between gap-3 rounded border border-white/10 bg-slate-950/30 px-3 py-2">
                            <span class="flex items-center gap-2 text-xs">
                                <span :class="item.ok ? 'text-emerald-400' : 'text-amber-300'" aria-hidden="true">{{ item.ok ? '✓' : '✕' }}</span>
                                {{ item.label }}
                            </span>
                            <span v-if="item.hint" class="max-w-[40%] truncate text-right text-[11px] text-slate-500" :title="item.hint">{{ item.hint }}</span>
                        </li>
                    </ul>
                </Card>

                <Card v-if="linkChecks.length" title="Проверка внутренних ссылок">
                    <div class="mb-2 flex flex-wrap gap-2 text-[11px]">
                        <span class="rounded bg-emerald-700/20 px-2 py-0.5 text-emerald-300">ОК: {{ linkChecks.filter(l => l.ok).length }}</span>
                        <span class="rounded bg-red-400/20 px-2 py-0.5 text-red-300">Битые: {{ linkChecks.filter(l => !l.ok).length }}</span>
                        <span class="rounded bg-amber-400/20 px-2 py-0.5 text-amber-300">Редирект: {{ linkChecks.filter(l => l.redirected).length }}</span>
                    </div>
                    <ul class="grid max-h-72 gap-1 overflow-auto pr-1">
                        <li v-for="(link, index) in linkChecks" :key="index"
                            class="flex items-center justify-between gap-3 rounded px-2 py-1 text-xs odd:bg-slate-950/30">
                            <a :href="link.url" target="_blank" rel="noreferrer" class="min-w-0 truncate text-slate-300 hover:text-sky-300">{{ link.url }}</a>
                            <span class="shrink-0"
                                :class="link.ok ? 'text-emerald-400' : 'text-red-400'">{{ link.status || '—' }}</span>
                        </li>
                    </ul>
                </Card>

                <div v-if="duplicateTitles.length || duplicateDescriptions.length" class="grid gap-4">
                    <Card v-if="duplicateTitles.length" title="Дубли Title">
                        <ul class="grid gap-1.5">
                            <li v-for="([title, count], index) in duplicateTitles" :key="index" class="text-xs text-amber-300">
                                «{{ title }}» — {{ count }} страниц
                            </li>
                        </ul>
                    </Card>
                    <Card v-if="duplicateDescriptions.length" title="Дубли Description">
                        <ul class="grid gap-1.5">
                            <li v-for="([description, count], index) in duplicateDescriptions" :key="index" class="text-xs text-amber-300">
                                «{{ description }}» — {{ count }} страниц
                            </li>
                        </ul>
                    </Card>
                </div>

                <Card v-if="sitemapInfo" title="Sitemap">
                    <dl class="grid gap-1.5 text-xs">
                        <div class="flex justify-between gap-3"><dt class="text-slate-400">Файл</dt><dd class="truncate">{{ sitemapInfo.url }}</dd></div>
                        <div class="flex justify-between gap-3"><dt class="text-slate-400">Доступен</dt>
                            <dd :class="sitemapInfo.exists ? 'text-emerald-400' : 'text-red-400'">{{ sitemapInfo.exists ? `Да (HTTP ${sitemapInfo.status})` : 'Нет' }}</dd></div>
                        <div class="flex justify-between gap-3"><dt class="text-slate-400">URL в sitemap</dt><dd>{{ sitemapInfo.count }}</dd></div>
                        <div class="flex justify-between gap-3"><dt class="text-slate-400">Текущая страница есть</dt>
                            <dd :class="sitemapInfo.containsCurrent ? 'text-emerald-400' : 'text-amber-300'">{{ sitemapInfo.containsCurrent ? 'Да' : 'Нет' }}</dd></div>
                        <div class="flex justify-between gap-3"><dt class="text-slate-400">Дубли в sitemap</dt>
                            <dd :class="sitemapInfo.duplicates ? 'text-amber-300' : 'text-emerald-400'">{{ sitemapInfo.duplicates }}</dd></div>
                    </dl>
                </Card>

                <Card v-if="robotsRules.length" title="Robots.txt для текущего пути">
                    <ul class="grid gap-1.5 text-xs">
                        <li v-for="(rule, index) in robotsRules" :key="index"
                            class="flex items-center justify-between rounded bg-slate-950/30 px-3 py-1.5">
                            <span>{{ rule.directive.toUpperCase() }}: {{ rule.value || '/' }}</span>
                            <span :class="rule.blocked ? 'text-red-400' : 'text-emerald-400'">{{ rule.blocked ? 'запрещено' : 'разрешено' }}</span>
                        </li>
                    </ul>
                </Card>
            </template>

            <p v-else-if="state === 'idle'" class="text-sm text-slate-400">
                Аудит проверит текущую страницу: мета-теги, заголовки, индексацию, скорость (TTFB),
                а затем обойдёт внутренние ссылки, найдёт битые ссылки и дубли Title/Description.
            </p>
        </div>
    </div>
</template>

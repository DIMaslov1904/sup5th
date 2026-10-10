<script setup>
import { computed, onUnmounted, ref } from 'vue'
import { fetchSeo, downloadText } from '../utils/seoClient.js'
import { collectSitemap, sitemapRoots } from '../utils/sitemap.js'
import Button from '../popup/components/ui/Button.vue'
import Message from '../popup/components/ui/Message.vue'

const props = defineProps({ tab: Object })
const result = ref(null), loading = ref(false), message = ref(''), search = ref(''), root = ref(''), progress = ref({ files: 0, urls: 0 }), visible = ref(200)
let controller
const pages = computed(() => (result.value?.pages || []).filter(item => item.url.toLowerCase().includes(search.value.toLowerCase())))
const load = async () => {
    loading.value = true; message.value = ''; result.value = null; progress.value = { files: 0, urls: 0 }; visible.value = 200
    controller = new AbortController()
    try {
        if (!props.tab?.url || !/^https?:/.test(props.tab.url)) throw new Error('Откройте сайт и запустите sitemap из расширения')
        let roots
        if (root.value.trim()) roots = [new URL(root.value.trim(), props.tab.url).href]
        else {
            const robots = await fetchSeo(new URL('/robots.txt', props.tab.url).href)
            controller.signal.throwIfAborted()
            roots = sitemapRoots(robots.ok ? robots.text : '', props.tab.url)
        }
        result.value = await collectSitemap(roots, url => fetchSeo(url, 'GET', 8 * 1024 * 1024), { signal: controller.signal, onProgress: value => { progress.value = value } })
    } catch (e) { message.value = e.name === 'AbortError' ? 'Загрузка остановлена' : e.message }
    finally { loading.value = false }
}
onUnmounted(() => controller?.abort())
const exportXml = () => {
    const escape = text => String(text).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;')
    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + result.value.pages.map(item => `  <url><loc>${escape(item.url)}</loc>${item.lastmod ? `<lastmod>${escape(item.lastmod)}</lastmod>` : ''}</url>`).join('\n') + '\n</urlset>'
    downloadText(xml, result.value.complete ? 'sitemap-unified.xml' : 'sitemap-partial.xml', 'application/xml')
}
</script>
<template>
    <section class="grid gap-4">
        <div><h1 class="text-2xl font-semibold">Единый sitemap</h1><p class="mt-1 break-all text-sm text-slate-400">{{ tab?.url || 'Сайт не выбран' }}</p></div>
        <p class="text-sm text-slate-400">Объединяет карты из robots.txt и вложенных sitemap-index. Можно указать свой начальный файл.</p>
        <div class="flex flex-wrap gap-2"><input v-model="root" :disabled="loading" placeholder="Автоматически из robots.txt или /sitemap.xml" class="min-w-64 flex-1 rounded border border-white/10 bg-slate-900 px-3 py-2 text-sm"/><Button :disabled="loading" @click="load">Загрузить sitemap</Button><Button v-if="loading" variant="secondary" @click="controller.abort()">Остановить</Button></div>
        <p v-if="loading" role="status" class="text-sm text-sky-300">Файлов: {{ progress.files }} · URL: {{ progress.urls }}</p>
        <Message v-if="message" type="error">{{ message }}</Message>
        <template v-if="result">
            <div class="flex flex-wrap items-center gap-3 text-sm"><span>URL: {{ result.pages.length }}</span><span>Файлов: {{ result.files.length }}</span><span>Дубли: {{ result.duplicates }}</span><span :class="result.complete ? 'text-emerald-300' : 'text-amber-300'">{{ result.complete ? 'Все обнаруженные файлы обработаны' : 'Частичный результат' }}</span><Button size="sm" variant="secondary" :disabled="!result.pages.length" @click="exportXml">Скачать общий XML</Button></div>
            <Message v-if="result.limited" type="error">Достигнут лимит: 200 файлов или 50 000 URL. Результат неполный.</Message>
            <details v-if="result.errors.length" open class="rounded-lg border border-amber-300/20 p-3 text-xs"><summary>Ошибки ({{ result.errors.length }})</summary><p v-for="item in result.errors" :key="item.url" class="mt-2 break-all">{{ item.url }} — {{ item.message }}</p></details>
            <details class="rounded-lg border border-white/10 p-3 text-xs"><summary class="cursor-pointer">Обработанные файлы</summary><p v-for="item in result.files" :key="item.url" class="mt-2 break-all">{{ item.url }} · {{ item.index ? 'индекс' : 'карта' }} · {{ item.count }}</p></details>
            <input v-model="search" placeholder="Поиск URL" class="rounded border border-white/10 bg-slate-900 px-3 py-2 text-sm" />
            <div class="grid gap-1 text-xs"><div v-for="item in pages.slice(0,visible)" :key="item.url" class="flex flex-wrap justify-between gap-2 rounded border border-white/10 bg-slate-900/40 p-3"><a :href="item.url" target="_blank" rel="noreferrer" class="break-all text-sky-300">{{ item.url }}</a><span class="text-slate-500">{{ item.lastmod }}</span></div></div>
            <Button v-if="pages.length > visible" variant="secondary" size="sm" @click="visible += 200">Показать ещё ({{ pages.length - visible }})</Button>
        </template>
    </section>
</template>

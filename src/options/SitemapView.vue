<script setup>
import { computed, onUnmounted, ref } from 'vue'
import { fetchSeo, downloadText } from '../utils/seoClient.js'
import { collectSitemap, sitemapRoots } from '../utils/sitemap.js'
import Button from '../popup/components/ui/Button.vue'
import Input from '../popup/components/ui/Input.vue'
import Message from '../popup/components/ui/Message.vue'
import Notification from '../popup/components/ui/Notification.vue'

const props = defineProps({ tab: Object })
const result = ref(null), loading = ref(false), message = ref(''), search = ref(''), root = ref(''), progress = ref({ files: 0, urls: 0 }), visible = ref(200)
let controller
const pages = computed(() => (result.value?.pages || []).filter(item => item.url.toLowerCase().includes(search.value.toLowerCase())))
const load = async () => {
    if (loading.value) return
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
        <div><h1 class="ui-title">Единый sitemap</h1><p class="mt-1 break-all text-[13px] text-ui-muted">{{ tab?.url || 'Сайт не выбран' }}</p></div>
        <p class="text-[13px] text-ui-muted">Объединяет карты из robots.txt и вложенных sitemap-index. Можно указать свой начальный файл.</p>
        <div class="flex flex-wrap gap-2"><Input v-model="root" :disabled="loading" placeholder="Автоматически из robots.txt или /sitemap.xml" class="min-w-64 flex-1"/><Button :loading="loading" @click="load">Загрузить sitemap</Button><Button v-if="loading" variant="secondary" @click="controller.abort()">Остановить</Button></div>
        <p v-if="loading" role="status" class="text-[13px] text-ui-accent">Файлов: {{ progress.files }} · URL: {{ progress.urls }}</p>
        <Notification v-if="message" :text="message" />
        <template v-if="result">
            <div class="flex flex-wrap items-center gap-3 text-[13px]"><span>URL: {{ result.pages.length }}</span><span>Файлов: {{ result.files.length }}</span><span>Дубли: {{ result.duplicates }}</span><span :class="result.complete ? 'text-ui-success' : 'text-ui-warning'">{{ result.complete ? 'Все обнаруженные файлы обработаны' : 'Частичный результат' }}</span><Button size="sm" variant="secondary" :disabled="!result.pages.length" @click="exportXml">Скачать общий XML</Button></div>
            <Message v-if="result.limited" type="error">Достигнут лимит: 200 файлов или 50 000 URL. Результат неполный.</Message>
            <details v-if="result.errors.length" open class="rounded-panel border border-ui-warning/30 p-3 text-xs"><summary>Ошибки ({{ result.errors.length }})</summary><p v-for="item in result.errors" :key="item.url" class="mt-2 break-all">{{ item.url }} — {{ item.message }}</p></details>
            <details class="ui-panel text-xs"><summary class="cursor-pointer">Обработанные файлы</summary><p v-for="item in result.files" :key="item.url" class="mt-2 break-all">{{ item.url }} · {{ item.index ? 'индекс' : 'карта' }} · {{ item.count }}</p></details>
            <Input v-model="search" placeholder="Поиск URL" />
            <div class="grid gap-1 text-xs"><div v-for="item in pages.slice(0,visible)" :key="item.url" class="flex flex-wrap justify-between gap-2 rounded border border-ui-border/70 bg-ui-panel/90 p-3"><a :href="item.url" target="_blank" rel="noreferrer" class="break-all text-ui-accent">{{ item.url }}</a><span class="text-ui-muted/70">{{ item.lastmod }}</span></div></div>
            <Button v-if="pages.length > visible" variant="secondary" size="sm" @click="visible += 200">Показать ещё ({{ pages.length - visible }})</Button>
        </template>
    </section>
</template>

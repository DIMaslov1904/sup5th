<script setup>
import { computed, onMounted, reactive, ref, shallowRef } from 'vue'
import { extensionApi } from '../platform/extensionApi.js'
import { displayUrl } from '../utils/displayUrl.js'
import { buildOpenGraphPreview, buildTwitterPreview } from '../utils/openGraphPreview.js'
import { sendSeoToTab, withActiveTab } from '../utils/seoClient.js'
import { collectMetaTags } from '../utils/seoDom.js'
import { fetchSeoDocument } from '../utils/seoHtml.js'
import EmptyState from '../popup/components/ui/EmptyState.vue'
import Preloader from '../popup/components/ui/Preloader.vue'

const params = new URLSearchParams(location.search)
const sourceId = Number(params.get('tabId')), sourceAddress = params.get('url')
const report = shallowRef(null)
const loading = ref(true), error = ref('')
const failedImages = reactive(new Set())
const openGraph = computed(() => buildOpenGraphPreview(report.value))
const twitter = computed(() => buildTwitterPreview(report.value, openGraph.value))
const previews = computed(() => [
    { layout: 'vk', label: 'ВКонтакте', content: openGraph.value,
        detail: 'Пример карточки публикации с изображением сверху. Точные размеры и обрезка зависят от клиента.' },
    { layout: 'max', label: 'MAX', content: openGraph.value,
        detail: 'Пример размещения миниатюры в сообщении. Документация MAX описывает поля карточки, а её размеры зависят от клиента.' },
    { layout: 'telegram-wide', label: 'Telegram · большая карточка', content: openGraph.value,
        detail: 'При поддержке медиа отправитель может выбрать его размер и разместить превью над текстом сообщения или под ним.' },
    { layout: 'telegram-small', label: 'Telegram · компактная карточка', content: openGraph.value,
        detail: 'В компактном варианте изображение показано миниатюрой рядом с текстом.' },
    { layout: twitter.value.layout || 'x-unavailable', label: 'X · Twitter Cards', content: twitter.value,
        detail: 'Формат задаёт twitter:card. Недостающие поля могут подставляться из Open Graph.' }
])
const showImage = url => url && !failedImages.has(url)

onMounted(async () => {
    try {
        if (sourceAddress) {
            const { document, url, baseUrl } = await fetchSeoDocument(sourceAddress)
            report.value = {
                url, baseUrl, title: document.title.trim(),
                description: document.head?.querySelector('meta[name="description" i]')?.content?.trim() || '',
                metaTags: collectMetaTags(document.head).filter(tag => /^(?:og|twitter):/i.test(tag.name))
            }
            return
        }
        if (!Number.isInteger(sourceId) || sourceId <= 0) return
        const tab = await extensionApi.tabs.get(sourceId)
        if (!/^https?:\/\//.test(tab.url || '')) return
        report.value = await withActiveTab(sourceId, () => sendSeoToTab(sourceId, 'seo:social'))
    } catch (reason) { if (sourceAddress) error.value = reason.message }
    finally { loading.value = false }
})
</script>

<template>
    <main class="ui-background min-h-screen text-ui-text">
        <div class="mx-auto grid min-w-0 max-w-5xl gap-6 px-5 py-6 sm:px-8 sm:py-8">
            <header class="grid min-w-0 gap-2 border-b border-ui-border pb-5">
                <p class="text-xs font-semibold tracking-wide text-ui-accent">SUP 5th · SEO</p>
                <h1 class="text-xl font-semibold">Предпросмотр ссылок</h1>
                <p v-if="report" class="wrap-anywhere text-sm text-ui-muted">{{ displayUrl(report.url) }}</p>
            </header>
            <Preloader v-if="loading" label="Читаем метатеги страницы…" />
            <EmptyState v-else-if="!report" title="Страница недоступна для предпросмотра."
                :description="error || 'Откройте исходный сайт и заново запустите предпросмотр из раздела «Разметка».'" />
            <template v-else>
                <div class="grid gap-1 text-xs leading-5 text-ui-muted">
                    <p>Карточки построены по метатегам открытой страницы. Размеры, обрезка и порядок элементов могут отличаться в приложениях.</p>
                    <p v-if="!openGraph.hasOg">Open Graph в head отсутствует. Для примеров используются заголовок и описание страницы.</p>
                    <p v-else-if="!openGraph.image">В Open Graph нет доступного адреса изображения.</p>
                    <p v-else-if="failedImages.has(openGraph.image)">Изображение Open Graph не загрузилось.</p>
                </div>
                <div class="grid min-w-0 items-start gap-x-6 gap-y-5 md:grid-cols-2">
                    <section v-for="{ layout, label, content, detail } in previews" :key="label" class="grid min-w-0 gap-2">
                        <h2 class="text-sm font-medium">{{ label }}</h2>
                        <p class="text-xs leading-5 text-ui-muted">{{ detail }}</p>
                        <article class="preview-card" :class="['preview-card--' + layout, { 'has-image': showImage(content.image) }]">
                            <p v-if="layout === 'x-unavailable'" class="preview-copy text-sm text-ui-muted">{{ content.note }}</p>
                            <template v-else>
                                <img v-if="showImage(content.image)" :src="content.image" :alt="content.imageAlt"
                                    referrerpolicy="no-referrer" decoding="async" class="preview-image" @error="failedImages.add(content.image)" />
                                <div class="preview-copy">
                                    <p v-if="layout === 'max' || layout.startsWith('telegram')" class="preview-site">{{ content.siteName }}</p>
                                    <p v-if="layout === 'x-small'" class="preview-domain">{{ content.domain }}</p>
                                    <h3 class="preview-title">{{ content.title }}</h3>
                                    <p v-if="content.description && layout !== 'vk' && layout !== 'x-wide'" class="preview-description">{{ content.description }}</p>
                                    <p v-if="layout === 'vk' || layout === 'x-wide'" class="preview-domain">{{ content.domain }}</p>
                                </div>
                            </template>
                        </article>
                        <p v-if="layout === 'x-small' || layout === 'x-wide'" class="text-xs text-ui-muted">{{ content.note || content.type }}</p>
                        <p v-if="layout.startsWith('x-') && layout !== 'x-unavailable' && failedImages.has(content.image) && content.image !== openGraph.image"
                            class="text-xs text-ui-muted">Изображение карточки X не загрузилось.</p>
                    </section>
                </div>
            </template>
        </div>
    </main>
</template>

<style scoped>
.preview-card {
    min-width: 0;
    overflow: hidden;
    border: 1px solid var(--color-ui-border);
    border-radius: 12px;
    background: var(--color-ui-panel);
}
.preview-image {
    display: block;
    width: 100%;
    aspect-ratio: 2 / 1;
    object-fit: cover;
    background: var(--color-ui-raised);
}
.preview-copy {
    display: grid;
    min-width: 0;
    align-content: center;
    gap: .25rem;
    padding: .75rem;
}
.preview-title, .preview-description {
    display: -webkit-box;
    overflow: hidden;
    overflow-wrap: anywhere;
    -webkit-box-orient: vertical;
}
.preview-title {
    font-size: .875rem;
    font-weight: 600;
    line-height: 1.3;
    -webkit-line-clamp: 2;
}
.preview-description {
    color: var(--color-ui-muted);
    font-size: .8125rem;
    line-height: 1.4;
    -webkit-line-clamp: 3;
}
.preview-site, .preview-domain {
    overflow: hidden;
    color: var(--color-ui-muted);
    font-size: .75rem;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.preview-site { color: var(--card-accent, var(--color-ui-accent)); font-weight: 600; }
.preview-card--vk .preview-copy { background: var(--color-ui-canvas); }
.preview-card--max {
    --card-accent: light-dark(#5b3abd, #b5a0ff);
    background: color-mix(in srgb, var(--card-accent) 5%, var(--color-ui-panel));
}
.preview-card--telegram-wide, .preview-card--telegram-small {
    --card-accent: var(--color-ui-accent);
    border-inline-start: 3px solid var(--card-accent);
    background: color-mix(in srgb, var(--card-accent) 7%, var(--color-ui-panel));
}
.preview-card--telegram-wide { display: flex; flex-direction: column; }
.preview-card--telegram-wide .preview-image {
    order: 1;
    width: calc(100% - 1.5rem);
    max-height: 18rem;
    margin: 0 .75rem .75rem;
    border-radius: 8px;
    aspect-ratio: auto;
}
.preview-card--max.has-image, .preview-card--telegram-small.has-image {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 5rem;
    align-items: start;
    gap: .75rem;
    padding: .75rem;
}
.preview-card--max.has-image .preview-copy, .preview-card--telegram-small.has-image .preview-copy { padding: 0; }
.preview-card--max .preview-image, .preview-card--telegram-small .preview-image {
    order: 1;
    aspect-ratio: 1;
    border-radius: 6px;
}
.preview-card--x-small.has-image { display: grid; grid-template-columns: min(7rem, 33%) minmax(0, 1fr); align-items: center; }
.preview-card--x-small .preview-image { aspect-ratio: 1; }
.preview-card--x-small .preview-description { -webkit-line-clamp: 2; }
.preview-card--x-wide { position: relative; }
.preview-card--x-wide.has-image .preview-title {
    position: absolute;
    inset: auto .5rem 2.5rem;
    width: fit-content;
    max-width: calc(100% - 1rem);
    padding: .25rem .375rem;
    border-radius: 4px;
    color: #fff;
    background: #111d;
    -webkit-line-clamp: 1;
}
.preview-card--x-wide.has-image .preview-copy { padding: .5rem .75rem; }
</style>

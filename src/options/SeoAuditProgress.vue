<script setup>
defineProps({ audit: Object, progress: { type: Object, required: true }, paused: Boolean })
</script>
<template>
    <div class="ui-panel min-w-0 text-xs">
        <div role="status">
            <template v-if="audit">
                HTTP{{ audit.mode === 'external' ? ' внешних URL' : '' }}: {{ progress.current }} из {{ progress.total }}<span v-if="audit.mode === 'external'"> · Обход страниц: {{ audit.crawl.current }} из {{ audit.crawl.total }}</span><span v-if="audit.sitemap.pending"> · sitemap загружается</span>
            </template>
            <span v-else>Снимок исходной страницы…</span>
            <p v-if="paused" class="mt-1 text-ui-warning">На паузе. Уже отправленные запросы завершаются.</p>
        </div>
        <progress :max="progress.total || 1" :value="progress.total ? progress.current : undefined" aria-label="Ход HTTP-проверки" class="mt-2 block h-1.5 w-full accent-ui-primary"></progress>
        <p class="mt-2 font-medium">Текущие запросы</p>
        <ul class="audit-active-requests mt-1 grid h-28 content-start gap-1 overflow-y-auto text-ui-muted" aria-label="Адреса, которые сейчас проверяются">
            <li v-for="request in progress.activeRequests" :key="request.id" class="wrap-anywhere"><span v-if="request.method" class="mr-1 font-mono">{{ request.method }}</span>{{ request.url }}</li>
            <li v-if="!progress.activeRequests.length">Нет активных запросов</li>
        </ul>
    </div>
</template>
<style scoped>
.audit-active-requests { scrollbar-gutter: stable; }
</style>

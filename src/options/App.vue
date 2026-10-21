<script setup>
import { extensionApi } from '../platform/extensionApi.js'
import { defineAsyncComponent } from 'vue'
import { useSeoSource } from './useSeoSource.js'
import { displayUrl } from '../utils/displayUrl.js'
const SeoAudit = defineAsyncComponent(() => import('./SeoAudit.vue'))
const SitemapView = defineAsyncComponent(() => import('./SitemapView.vue'))
const SeoPanel = defineAsyncComponent(() => import('../popup/components/SeoPanel.vue'))
import Message from '../popup/components/ui/Message.vue'
import NotificationHost from '../popup/components/ui/NotificationHost.vue'
import Tabs from '../popup/components/ui/Tabs.vue'

const params = new URLSearchParams(location.search)
const props = defineProps({ docked: Boolean })
const homeUrl = extensionApi.runtime.getURL('src/options/index.html')
const { tab, error, ready, section, seoSection, sourceRevision, select, selectSeoSection } = useSeoSource(props.docked, params)
</script>
<template>
    <main class="min-h-screen ui-background flex flex-col text-ui-text">
        <div class="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5 py-6">
            <header class="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-ui-border/70 pb-4">
                <a :href="homeUrl" class="font-semibold tracking-wide text-ui-accent">SUP 5th</a>
                <button v-if="docked && tab" type="button" :title="tab.url" class="min-w-0 max-w-[65%] truncate text-xs text-ui-muted hover:text-ui-accent" @click="extensionApi.tabs.update(tab.id, {active:true})">{{ displayUrl(tab.url) }}</button>
                <Tabs v-model="section" :items="[['overview','SEO страницы'],['seo','Детальный аудит'],['sitemap','Единый sitemap']]" label="Инструменты расширения" @update:model-value="select" />
            </header>
            <template v-if="ready">
                <Message v-if="error || !tab" type="error">{{ error || 'Откройте проверяемый сайт и запустите SEO-инструменты через расширение.' }}</Message>
                <SeoAudit v-else-if="section === 'seo'" :key="sourceRevision" :tab="tab" />
                <SitemapView v-else-if="section === 'sitemap'" :key="sourceRevision" :tab="tab" />
                <SeoPanel v-else-if="section === 'overview'" :key="sourceRevision" :tab="tab" :initial-section="seoSection" :docked="docked" expanded @section-change="selectSeoSection" />
            </template>
        </div>
    </main>
    <NotificationHost />
</template>

<script setup>
import { extensionApi } from '../platform/extensionApi.js'
import { defineAsyncComponent } from 'vue'
import { useSeoSource } from './useSeoSource.js'
const SeoAudit = defineAsyncComponent(() => import('./SeoAudit.vue'))
const SitemapView = defineAsyncComponent(() => import('./SitemapView.vue'))
const SeoPanel = defineAsyncComponent(() => import('../popup/components/SeoPanel.vue'))
import Button from '../popup/components/ui/Button.vue'
import Input from '../popup/components/ui/Input.vue'
import Message from '../popup/components/ui/Message.vue'
import NotificationHost from '../popup/components/ui/NotificationHost.vue'
import Tabs from '../popup/components/ui/Tabs.vue'

const params = new URLSearchParams(location.search)
const props = defineProps({ docked: Boolean })
const homeUrl = extensionApi.runtime.getURL('src/options/index.html')
const { tab, error, ready, address, addressError, opening, inspectAddress, section, seoSection, sourceRevision, select, selectSeoSection, rememberAnnotations } = useSeoSource(props.docked, params)
</script>
<template>
    <main class="min-h-screen ui-background flex flex-col text-ui-text">
        <div class="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5 py-6">
            <header class="mb-6 grid grid-cols-1 gap-3 border-b border-ui-border/70 pb-4">
                <div class="flex flex-wrap items-center justify-between gap-4">
                    <a :href="homeUrl" class="font-semibold tracking-wide text-ui-accent">SUP 5th</a>
                    <Tabs v-model="section" :items="[['overview','SEO страницы'],['seo','Детальный аудит'],['sitemap','Единый sitemap']]" label="Инструменты расширения" @update:model-value="select" />
                </div>
                <form v-if="!docked" class="flex items-center gap-2" @submit.prevent="inspectAddress">
                    <Input v-model="address" aria-label="Адрес сайта" inputmode="url" autocomplete="off" spellcheck="false" placeholder="https://example.com" class="min-w-0 flex-1" required :disabled="opening" @update:model-value="addressError = ''" />
                    <Button type="submit" :loading="opening">Проверить</Button>
                </form>
                <Message v-if="!docked && addressError">{{ addressError }}</Message>
            </header>
            <p v-if="!ready" class="text-[13px] text-ui-muted" role="status">Загружаем страницу…</p>
            <Message v-else-if="error">{{ error }}</Message>
            <KeepAlive v-if="tab" :key="sourceRevision">
                <SeoAudit v-if="section === 'seo'" :tab="tab" />
                <SitemapView v-else-if="section === 'sitemap'" :tab="tab" />
                <SeoPanel v-else-if="section === 'overview'" :tab="tab" :initial-section="seoSection" :docked="docked" expanded
                    @section-change="selectSeoSection" @annotations-change="rememberAnnotations" />
            </KeepAlive>
        </div>
    </main>
    <NotificationHost />
</template>

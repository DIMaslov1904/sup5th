<script setup>
import { defineAsyncComponent, onMounted, ref } from 'vue'
import Instruction from './Instruction.vue'
const SeoAudit = defineAsyncComponent(() => import('./SeoAudit.vue'))
const SitemapView = defineAsyncComponent(() => import('./SitemapView.vue'))
const SeoPanel = defineAsyncComponent(() => import('../popup/components/SeoPanel.vue'))
import Message from '../popup/components/ui/Message.vue'
import Tabs from '../popup/components/ui/Tabs.vue'

const params = new URLSearchParams(location.search)
const homeUrl = chrome.runtime.getURL('src/options/index.html')
const section = ref(['seo', 'sitemap', 'overview'].includes(params.get('tool')) ? params.get('tool') : 'instruction')
const tab = ref(null), error = ref(''), ready = ref(false)
onMounted(async () => {
    try {
        const id = Number(params.get('tabId'))
        if (Number.isInteger(id) && id > 0) tab.value = await chrome.tabs.get(id)
        if (!tab.value?.url || !/^https?:/.test(tab.value.url)) tab.value = null
    } catch { error.value = 'Исходная вкладка закрыта. Откройте инструменты заново из проверяемого сайта.' }
    finally { ready.value = true }
})
const select = name => { section.value = name; params.set('tool', name); history.replaceState(null, '', `?${params}`) }
</script>
<template>
    <main class="min-h-screen ui-background text-ui-text">
        <div class="mx-auto max-w-5xl px-5 py-6">
            <header class="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-ui-border/70 pb-4">
                <a :href="homeUrl" class="font-semibold tracking-wide text-ui-accent">SUP 5th</a>
                <Tabs v-model="section" :items="[['instruction','Инструкция'],['overview','SEO страницы'],['seo','Детальный аудит'],['sitemap','Единый sitemap']]" label="Инструменты расширения" @update:model-value="select" />
            </header>
            <Instruction v-if="section === 'instruction'" />
            <template v-else-if="ready">
                <Message v-if="error || !tab" type="error">{{ error || 'Откройте проверяемый сайт и запустите SEO-инструменты через расширение.' }}</Message>
                <SeoAudit v-else-if="section === 'seo'" :tab="tab" />
                <SitemapView v-else-if="section === 'sitemap'" :tab="tab" />
                <SeoPanel v-else-if="section === 'overview'" :tab="tab" />
            </template>
        </div>
    </main>
</template>

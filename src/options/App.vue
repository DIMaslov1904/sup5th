<script setup>
import { defineAsyncComponent, onMounted, ref } from 'vue'
import Instruction from './Instruction.vue'
const SeoAudit = defineAsyncComponent(() => import('./SeoAudit.vue'))
const SitemapView = defineAsyncComponent(() => import('./SitemapView.vue'))
const SeoPanel = defineAsyncComponent(() => import('../popup/components/SeoPanel.vue'))
import Message from '../popup/components/ui/Message.vue'

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
    <main class="min-h-screen bg-linear-[135deg,#0f172a,0%,#1e293b,30%,#334155,60%,#1e293b] text-slate-200">
        <div class="mx-auto max-w-5xl px-5 py-6">
            <header class="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
                <a :href="homeUrl" class="font-semibold tracking-wide text-sky-300">SUP 5th</a>
                <nav class="flex flex-wrap gap-1" aria-label="Инструменты расширения">
                    <button v-for="[name,label] in [['instruction','Инструкция'],['overview','SEO страницы'],['seo','Детальный аудит'],['sitemap','Единый sitemap']]" :key="name" @click="select(name)" class="cursor-pointer rounded-lg px-3 py-2 text-sm hover:bg-white/10" :class="section === name ? 'bg-sky-400/15 text-sky-300' : 'text-slate-400'">{{ label }}</button>
                </nav>
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

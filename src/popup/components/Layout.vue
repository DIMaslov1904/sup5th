<script setup>
import IconButton from './ui/IconButton.vue'
import Input from './ui/Input.vue'
import Button from './ui/Button.vue'
const modelItemMenu = defineModel()
const search = defineModel('search', { type: String, default: '' })
const emit = defineEmits(['search', 'ticket'])
</script>
<template>
    <div
        class="ui-background flex h-full min-h-screen w-full flex-col overflow-hidden text-ui-text">
        <nav id="menu" aria-label="Основная навигация" class="fixed inset-x-3 top-2 z-10 flex items-center gap-1 rounded-panel border border-ui-border bg-ui-panel/95 p-1 shadow-lg backdrop-blur-sm">
            <IconButton label="Сайт" @click="modelItemMenu = 'site'">
                <svg class="size-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-8H9v8H4a1 1 0 0 1-1-1Z" />
                </svg>
            </IconButton>
            <button type="button" aria-label="SEO" title="SEO-анализ текущей страницы" @click="modelItemMenu = 'seo'"
                class="ui-icon-button w-auto px-2 text-xs font-semibold">SEO</button>
            <label class="relative min-w-0 flex-1">
                <svg class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true">
                    <circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" />
                </svg>
                <Input v-model="search" type="search" aria-label="Поиск сервисов и проектов" placeholder="Поиск проектов и сервисов" autocomplete="off"
                    class="pr-2 pl-8 text-xs"
                    @focus="emit('search')" />
            </label>
            <Button variant="ghost" class="px-2 text-xs" @click="emit('ticket')">Тикет</Button>
            <IconButton label="Настройки" @click="modelItemMenu = 'settings'">
                <svg class="size-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="m9.5 3-.6 2.2-2 .9-2.1-.6-2.5 4.3 1.5 1.6v2.2l-1.5 1.6 2.5 4.3 2.1-.6 2 .9.6 2.2h5l.6-2.2 2-.9 2.1.6 2.5-4.3-1.5-1.6v-2.2l1.5-1.6-2.5-4.3-2.1.6-2-.9L14.5 3Z" /><circle cx="12" cy="12" r="3" />
                </svg>
            </IconButton>
        </nav>
        <div class="app-scroll min-h-0 overflow-y-auto pt-16 pb-6 h-full">
            <slot />
        </div>
    </div>
</template>

<script setup>
const modelItemMenu = defineModel()
const search = defineModel('search', { type: String, default: '' })
const emit = defineEmits(['search', 'ticket'])
</script>
<template>
    <div
        class="bg-linear-[135deg,#0f172a,0%,#1e293b,30%,#334155,60%,#1e293b] before:fixed before:inset-[35%] before:block before:rounded-full before:blur-2xl before:bg-white/15 flex flex-col min-h-screen w-full text-[#94a3b8] before:-z-10 overflow-hidden h-full">
        <nav id="menu" aria-label="Основная навигация" class="fixed inset-x-3 top-2 z-10 flex items-center gap-2 rounded-xl border border-white/10 bg-slate-800/95 p-1.5 shadow-lg backdrop-blur-sm">
            <button type="button" aria-label="Сайт" title="Сайт" @click="modelItemMenu = 'site'"
                class="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white">
                <svg class="size-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-8H9v8H4a1 1 0 0 1-1-1Z" />
                </svg>
            </button>
            <label class="relative min-w-0 flex-1">
                <svg class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true">
                    <circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" />
                </svg>
                <input v-model="search" type="search" aria-label="Поиск сервисов и проектов" placeholder="Поиск проектов и сервисов" autocomplete="off"
                    class="h-9 w-full rounded-lg border border-white/10 bg-slate-950/50 py-2 pr-2 pl-8 text-xs text-slate-100 outline-none transition-colors placeholder:text-slate-500 focus:border-sky-400/60 focus:ring-1 focus:ring-sky-400/20"
                    @focus="emit('search')" />
            </label>
            <button type="button" @click="emit('ticket')" class="h-9 shrink-0 cursor-pointer rounded-lg border border-white/10 px-3 text-xs font-medium text-slate-200 transition-colors hover:bg-white/10 hover:text-white">Тикет</button>
            <button type="button" aria-label="Настройки" title="Настройки" @click="modelItemMenu = 'settings'"
                class="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white">
                <svg class="size-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="m9.5 3-.6 2.2-2 .9-2.1-.6-2.5 4.3 1.5 1.6v2.2l-1.5 1.6 2.5 4.3 2.1-.6 2 .9.6 2.2h5l.6-2.2 2-.9 2.1.6 2.5-4.3-1.5-1.6v-2.2l1.5-1.6-2.5-4.3-2.1.6-2-.9L14.5 3Z" /><circle cx="12" cy="12" r="3" />
                </svg>
            </button>
        </nav>
        <div class="app-scroll min-h-0 overflow-y-auto pt-16 pb-6 h-full">
            <slot />
        </div>
    </div>
</template>

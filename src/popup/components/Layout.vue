<script setup>
import IconButton from './ui/IconButton.vue'
import Input from './ui/Input.vue'
import Button from './ui/Button.vue'
import { securityStatus, refreshSecurityStatus, refreshJob, activeSupportTicket } from '../backgroundState.js'
import { lockCredentialVault } from '../data/projectData.js'
import { ensureUnlocked } from '../unlockStore.js'
import { ref } from 'vue'
import { openTicket, searchTicketNumber } from '../../utils/ticketNavigation.js'
import Notification from './ui/Notification.vue'
const modelItemMenu = defineModel()
const search = defineModel('search', { type: String, default: '' })
const emit = defineEmits(['search', 'ticket'])
const locking = ref(false), lockError = ref('')
const openingTicket = ref(false), ticketError = ref('')
const openCurrentTicket = async () => {
    if (!activeSupportTicket.value) { emit('ticket'); return }
    if (openingTicket.value) return
    openingTicket.value = true; ticketError.value = ''
    try { await openTicket(activeSupportTicket.value.ticketId) }
    catch (reason) { ticketError.value = reason.message || 'Не удалось открыть тикет' }
    finally { openingTicket.value = false }
}
const pasteSearch = async event => {
    const number = searchTicketNumber(event.clipboardData?.getData('text/plain'))
    if (!number) return
    event.preventDefault()
    if (openingTicket.value) return
    openingTicket.value = true; ticketError.value = ''
    try { await openTicket(number) }
    catch (reason) { ticketError.value = reason.message || 'Не удалось открыть тикет' }
    finally { openingTicket.value = false }
}
const toggleLock = async () => {
    if (!securityStatus.value.enabled) { modelItemMenu.value = 'settings'; return }
    locking.value = true; lockError.value = ''
    try {
        if (securityStatus.value.unlocked) await lockCredentialVault()
        else await ensureUnlocked(async () => {}, { refreshAfterUnlock: false })
        await refreshSecurityStatus()
    } catch (error) { lockError.value = error.message }
    finally { locking.value = false }
}
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
            <IconButton label="Инструменты" @click="modelItemMenu = 'tools'"><svg class="size-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 6.5a5 5 0 0 0-6.1 6.1L3 18a2.1 2.1 0 0 0 3 3l5.4-5.4a5 5 0 0 0 6.1-6.1l-3 3-3-3Z"/></svg></IconButton>
            <label class="relative min-w-0 flex-1">
                <svg class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true">
                    <circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" />
                </svg>
                <Input v-model="search" type="search" aria-label="Поиск сервисов и проектов" placeholder="Поиск проектов и сервисов" autocomplete="off"
                    class="pr-2 pl-8 text-xs"
                    @click="emit('search')" @keydown.enter.prevent="emit('search')" @paste="pasteSearch" />
            </label>
            <Button variant="ghost" class="px-2 text-xs tabular-nums" :disabled="openingTicket"
                :title="activeSupportTicket ? `Отсчёт с ${new Date(activeSupportTicket.startedAt).toLocaleString('ru-RU')}` : 'Перейти к тикету'"
                @click="openCurrentTicket">{{ activeSupportTicket ? activeSupportTicket.ticketId : 'Тикет' }}</Button>
            <IconButton :label="!securityStatus.enabled ? 'Защита выключена — настройки' : securityStatus.unlocked ? 'Заблокировать хранилище' : 'Разблокировать хранилище'" :disabled="locking || !securityStatus.ready" :class="securityStatus.enabled ? securityStatus.unlocked ? 'text-ui-success' : 'text-ui-warning' : 'text-ui-muted'" @click="toggleLock"><svg class="size-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path :d="securityStatus.enabled && !securityStatus.unlocked ? 'M8 10V6a4 4 0 0 1 8 0v4' : 'M16 10V6a4 4 0 0 0-8 0'"/><path d="M12 14v3"/></svg></IconButton>
            <IconButton label="Настройки" @click="modelItemMenu = 'settings'">
                <svg class="size-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="m9.5 3-.6 2.2-2 .9-2.1-.6-2.5 4.3 1.5 1.6v2.2l-1.5 1.6 2.5 4.3 2.1-.6 2 .9.6 2.2h5l.6-2.2 2-.9 2.1.6 2.5-4.3-1.5-1.6v-2.2l1.5-1.6-2.5-4.3-2.1.6-2-.9L14.5 3Z" /><circle cx="12" cy="12" r="3" />
                </svg>
            </IconButton>
        </nav>
        <div class="app-scroll flex min-h-0 flex-1 flex-col overflow-y-auto pt-16 pb-6">
            <p v-if="refreshJob.running" role="status" class="mx-4 mb-3 flex items-center gap-2 text-xs text-ui-accent"><span class="ui-loading" aria-hidden="true"></span>Загрузка данных: {{ refreshJob.completed }} / {{ refreshJob.total }}</p>
            <Notification v-if="lockError" :text="lockError" />
            <Notification v-if="ticketError" :text="ticketError" />
            <slot />
        </div>
    </div>
</template>

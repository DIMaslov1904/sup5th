<script setup>
import { nextTick, ref, watch } from 'vue'

const open = defineModel('open', { type: Boolean, default: false })
const dialog = ref(null), input = ref(null)
const ticket = ref(''), error = ref(''), loading = ref(false)
watch(open, async visible => {
    await nextTick()
    if (!visible) { dialog.value?.close(); return }
    ticket.value = ''; error.value = ''
    dialog.value.showModal()
    input.value.focus()
})
const go = async () => {
    const number = ticket.value.trim().replace(/^0+/, '')
    if (!/^\d+$/.test(number)) { error.value = 'Введите положительный целый номер тикета'; input.value.focus(); return }
    loading.value = true; error.value = ''
    try {
        await chrome.tabs.create({ url: `https://support.5th.ru/published/index.php?app=ST#requests/all/id/${number}` })
        open.value = false
    } catch (reason) { error.value = reason.message || 'Не удалось открыть тикет' }
    finally { loading.value = false }
}
</script>

<template>
    <dialog ref="dialog" aria-labelledby="ticket-title" class="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-5 text-slate-200 shadow-2xl backdrop:bg-slate-950/75 backdrop:backdrop-blur-sm"
        @close="open = false" @click="event => { if (event.target === dialog) open = false }">
        <form class="grid gap-4" @submit.prevent="go">
            <div class="flex items-center justify-between gap-3">
                <h2 id="ticket-title" class="text-base font-semibold text-white">Перейти к тикету</h2>
                <button type="button" aria-label="Закрыть" class="flex size-7 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-white" @click="open = false">
                    <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
                </button>
            </div>
            <div class="grid gap-2">
                <label for="ticket-number" class="text-xs text-slate-400">Номер тикета</label>
                <input id="ticket-number" ref="input" v-model="ticket" type="text" inputmode="numeric" autocomplete="off" maxlength="18" placeholder="Например, 12345"
                    :aria-invalid="Boolean(error)" :aria-describedby="error ? 'ticket-error' : undefined"
                    class="h-10 w-full rounded-lg border border-white/10 bg-slate-950/50 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-sky-400/60 focus:ring-1 focus:ring-sky-400/20" />
                <p v-if="error" id="ticket-error" role="alert" class="text-xs text-red-300">{{ error }}</p>
            </div>
            <button type="submit" :disabled="loading" class="h-10 cursor-pointer rounded-lg bg-sky-700 px-4 text-sm font-medium text-white transition-colors hover:bg-sky-600 disabled:pointer-events-none disabled:opacity-50">{{ loading ? 'Открываем…' : 'Перейти' }}</button>
        </form>
    </dialog>
</template>

<script setup>
import { nextTick, ref, watch } from 'vue'
import Modal from './ui/Modal.vue'
import Input from './ui/Input.vue'
import Button from './ui/Button.vue'
import Message from './ui/Message.vue'

const open = defineModel('open', { type: Boolean, default: false })
const input = ref(null)
const ticket = ref(''), error = ref(''), loading = ref(false)
watch(open, async visible => {
    await nextTick()
    if (!visible) return
    ticket.value = ''; error.value = ''
    input.value?.$el?.focus()
})
const go = async () => {
    const number = ticket.value.trim().replace(/^0+/, '')
    if (!/^\d+$/.test(number)) { error.value = 'Введите положительный целый номер тикета'; input.value?.$el?.focus(); return }
    loading.value = true; error.value = ''
    try {
        await chrome.tabs.create({ url: `https://support.5th.ru/published/index.php?app=ST#/requests/search/${number}/` })
        open.value = false
    } catch (reason) { error.value = reason.message || 'Не удалось открыть тикет' }
    finally { loading.value = false }
}
</script>

<template>
    <Modal v-model:open="open" title="Перейти к тикету">
        <form class="grid gap-4" @submit.prevent="go">
            <div class="grid gap-2">
                <label for="ticket-number" class="text-xs text-ui-muted">Номер тикета</label>
                <Input id="ticket-number" ref="input" v-model="ticket" type="text" inputmode="numeric" autocomplete="off" maxlength="18" placeholder="Например, 12345" autofocus
                    :aria-invalid="Boolean(error)" :aria-describedby="error ? 'ticket-error' : undefined"
                    />
                <Message v-if="error" id="ticket-error" type="error">{{ error }}</Message>
            </div>
            <Button type="submit" :loading="loading">Перейти</Button>
        </form>
    </Modal>
</template>

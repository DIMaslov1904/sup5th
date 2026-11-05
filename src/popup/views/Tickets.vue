<script setup>
import { nextTick, onMounted, ref } from 'vue'
import Button from '../components/ui/Button.vue'
import Card from '../components/ui/Card.vue'
import Input from '../components/ui/Input.vue'
import Message from '../components/ui/Message.vue'
import { activeSupportTicket } from '../backgroundState.js'
import { resetActiveSupportTicket } from '../data/projectData.js'
import { openTicket, ticketDigits } from '../../utils/ticketNavigation.js'

const input = ref(null)
const ticket = ref(''), error = ref(null), pending = ref('')
const resetDone = ref(false)

onMounted(() => input.value?.$el?.focus())

const run = async (action, execute, failureMessage) => {
    if (pending.value) return false
    pending.value = action
    error.value = null
    resetDone.value = false
    try { await execute(); return true }
    catch (reason) {
        error.value = { action, text: reason.message || failureMessage }
        return false
    }
    finally { pending.value = '' }
}

const go = async (number, action) => {
    await run(action, () => openTicket(number), 'Не удалось открыть тикет')
    if (error.value?.action === 'search') {
        await nextTick()
        input.value?.$el?.focus()
    }
}

const reset = async () => {
    if (!await run('reset', resetActiveSupportTicket, 'Не удалось сбросить отсчёт')) return
    resetDone.value = true
    await nextTick()
    input.value?.$el?.focus()
}

const pasteTicket = event => {
    if (pending.value) return
    ticket.value = ticketDigits(event.clipboardData?.getData('text/plain'))
    return go(ticket.value, 'search')
}
</script>

<template>
    <section class="grid gap-4 px-4">
        <Card v-if="activeSupportTicket" title="Текущий тикет">
            <p class="mb-3 text-xs text-ui-muted">
                №{{ activeSupportTicket.ticketId }} · Отсчёт с {{ new Date(activeSupportTicket.startedAt).toLocaleString('ru-RU') }}
            </p>
            <div class="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" :disabled="Boolean(pending)" :loading="pending === 'current'"
                    @click="go(activeSupportTicket.ticketId, 'current')">Открыть текущий тикет</Button>
                <Button size="sm" variant="ghost" :disabled="Boolean(pending)" :loading="pending === 'reset'"
                    @click="reset">Сбросить отсчёт</Button>
            </div>
        </Card>
        <Card>
            <form class="grid gap-3" @submit.prevent="go(ticket, 'search')">
                <label for="ticket-number" class="text-xs text-ui-muted">Номер тикета</label>
                <Input id="ticket-number" ref="input" v-model="ticket" inputmode="numeric" autocomplete="off"
                    placeholder="Например, 12345" :disabled="Boolean(pending)" @paste.prevent="pasteTicket" />
                <Button type="submit" :disabled="Boolean(pending)" :loading="pending === 'search'">Открыть тикет</Button>
            </form>
        </Card>
        <Message v-if="error" type="error">{{ error.text }}</Message>
        <Message v-else-if="resetDone && !activeSupportTicket" type="success">Отсчёт по тикету сброшен.</Message>
    </section>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { cancelUnlock, runHelloUnlock, submitPin, unlockState } from '../unlockStore'
import Input from './ui/Input.vue'
import Button from './ui/Button.vue'
import Modal from './ui/Modal.vue'
import Message from './ui/Message.vue'
const modalOpen = computed({ get: () => unlockState.visible, set: value => { if (!value && unlockState.visible) cancelUnlock() } })

const pin = ref('')
const inputRef = ref(null)

watch(() => unlockState.visible, async (visible) => {
    if (!visible) return
    pin.value = ''
    unlockState.error = ''
    if (unlockState.mode === 'hello') {
        runHelloUnlock()
    } else {
        await nextTick()
        inputRef.value?.$el?.focus()
    }
})

// Авторазблокировка сразу после ввода PIN (без кнопки подтверждения)
watch(pin, (value) => {
    const trimmed = String(value || '').trim()
    if (trimmed.length >= 4) submitPin(trimmed)
})

// При неверном коротком PIN очищаем поле и возвращаем фокус;
// длинный PIN (>4) не стираем, чтобы можно было допечатать.
watch(() => unlockState.error, async (error) => {
    if (!error || unlockState.mode !== 'pin') return
    if (String(pin.value || '').trim().length <= 4) {
        pin.value = ''
        await nextTick()
        inputRef.value?.$el?.focus()
    }
})
</script>

<template>
    <Modal v-model:open="modalOpen" title="Разблокировка хранилища">
        <div class="grid gap-4">

            <template v-if="unlockState.mode === 'pin'">
                <Input ref="inputRef" v-model="pin" type="password" inputmode="numeric" autocomplete="off"
                    maxlength="12" placeholder="PIN-код" :disabled="unlockState.loading" autofocus />
                <p class="text-xs text-ui-muted">Введите PIN — хранилище разблокируется сразу после ввода.</p>
            </template>

            <template v-else>
                <div v-if="unlockState.loading" role="status" class="flex items-center gap-3 text-[13px] text-ui-accent">
                    <span class="ui-loading" aria-hidden="true"></span>
                    <span>Ожидаем Windows Hello…</span>
                </div>
                <p class="text-xs text-ui-muted">
                    Выполните проверку Windows Hello в открывшемся системном окне (PIN / отпечаток / лицо).
                </p>
            </template>

            <Message v-if="unlockState.error" type="error">{{ unlockState.error }}</Message>

            <div class="flex justify-end gap-2">
                <Button v-if="unlockState.mode === 'hello'" variant="secondary" size="sm"
                    :disabled="unlockState.loading" @click="runHelloUnlock">Повторить</Button>
                <Button variant="ghost" size="sm" @click="cancelUnlock">Отмена</Button>
            </div>
        </div>
    </Modal>
</template>

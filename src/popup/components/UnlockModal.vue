<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { cancelUnlock, runHelloUnlock, runPinUnlock, unlockState } from '../unlockStore'
import Button from './ui/Button.vue'
import Modal from './ui/Modal.vue'
import Message from './ui/Message.vue'
const modalOpen = computed({ get: () => unlockState.visible, set: value => { if (!value) cancelUnlock() } })
const pinInput = ref(null)
const pin = ref('')
const isPin = computed(() => unlockState.mode === 'pin')
watch(() => unlockState.visible, visible => {
    if (!visible) return
    if (isPin.value) {
        pin.value = ''
        nextTick(() => pinInput.value?.focus()).catch(() => {})
    } else {
        runHelloUnlock()
    }
})
watch(pin, value => {
    if (isPin.value && !unlockState.loading && value.length === 6) runPinUnlock(value)
})
watch(() => unlockState.error, error => { if (isPin.value && error) pin.value = '' })
</script>
<template>
    <Modal v-model:open="modalOpen" title="Разблокировка хранилища">
        <div class="grid gap-4">
            <template v-if="isPin">
                <p class="text-xs text-ui-muted">Введите PIN-код — хранилище разблокируется автоматически.</p>
                <input ref="pinInput" v-model="pin" type="password" maxlength="6" autocomplete="off" spellcheck="false"
                    placeholder="••••••" aria-label="PIN-код" :disabled="unlockState.loading"
                    class="ui-field text-center text-lg tracking-[0.5em]" />
            </template>
            <template v-else>
                <p v-if="unlockState.loading" role="status" class="flex items-center gap-3 text-ui-accent"><span class="ui-loading" aria-hidden="true"></span>Подтвердите вход на устройстве…</p>
                <p class="text-xs text-ui-muted">Используйте биометрию или системный способ проверки устройства.</p>
            </template>
            <Message v-if="unlockState.error" type="error">{{ unlockState.error }}</Message>
            <div class="flex justify-end gap-2">
                <Button v-if="!isPin && !unlockState.loading" variant="secondary" size="sm" @click="runHelloUnlock">Повторить</Button>
                <Button variant="ghost" size="sm" @click="cancelUnlock">Отмена</Button>
            </div>
        </div>
    </Modal>
</template>

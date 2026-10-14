<script setup>
import { computed, watch } from 'vue'
import { cancelUnlock, runHelloUnlock, unlockState } from '../unlockStore'
import Button from './ui/Button.vue'
import Modal from './ui/Modal.vue'
import Message from './ui/Message.vue'
const modalOpen = computed({ get: () => unlockState.visible, set: value => { if (!value) cancelUnlock() } })
watch(() => unlockState.visible, visible => { if (visible) runHelloUnlock() })
</script>
<template>
    <Modal v-model:open="modalOpen" title="Разблокировка хранилища">
        <div class="grid gap-4">
            <p v-if="unlockState.loading" role="status" class="flex items-center gap-3 text-ui-accent"><span class="ui-loading" aria-hidden="true"></span>Подтвердите вход на устройстве…</p>
            <p class="text-xs text-ui-muted">Используйте биометрию или системный способ проверки устройства.</p>
            <Message v-if="unlockState.error" type="error">{{ unlockState.error }}</Message>
            <div class="flex justify-end gap-2"><Button v-if="!unlockState.loading" variant="secondary" size="sm" @click="runHelloUnlock">Повторить</Button><Button variant="ghost" size="sm" @click="cancelUnlock">Отмена</Button></div>
        </div>
    </Modal>
</template>

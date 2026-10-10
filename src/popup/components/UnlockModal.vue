<script setup>
import { nextTick, ref, watch } from 'vue'
import { cancelUnlock, runHelloUnlock, submitPin, unlockState } from '../unlockStore'
import Input from './ui/Input.vue'
import Button from './ui/Button.vue'

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
    <div v-if="unlockState.visible" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
        <div class="w-full max-w-xs grid gap-4 rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-2xl">
            <h2 class="text-base font-semibold text-white">Разблокировка хранилища</h2>

            <template v-if="unlockState.mode === 'pin'">
                <Input ref="inputRef" v-model="pin" type="password" inputmode="numeric" autocomplete="off"
                    maxlength="12" placeholder="PIN-код" :disabled="unlockState.loading" />
                <p class="text-xs text-slate-400">Введите PIN — хранилище разблокируется сразу после ввода.</p>
            </template>

            <template v-else>
                <div v-if="unlockState.loading" role="status" class="flex items-center gap-3 text-sm text-sky-300">
                    <span class="h-5 w-5 shrink-0 rounded-full border-2 border-sky-300/25 border-t-sky-300 motion-safe:animate-spin" aria-hidden="true"></span>
                    <span>Ожидаем Windows Hello…</span>
                </div>
                <p class="text-xs text-slate-300">
                    Выполните проверку Windows Hello в открывшемся системном окне (PIN / отпечаток / лицо).
                </p>
            </template>

            <p v-if="unlockState.error" class="text-xs text-red-300">{{ unlockState.error }}</p>

            <div class="flex justify-end gap-2">
                <Button v-if="unlockState.mode === 'hello'" variant="secondary" size="sm"
                    :disabled="unlockState.loading" @click="runHelloUnlock">Повторить</Button>
                <Button variant="ghost" size="sm" @click="cancelUnlock">Отмена</Button>
            </div>
        </div>
    </div>
</template>

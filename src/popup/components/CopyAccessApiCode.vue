<script setup>
import { onUnmounted, ref } from 'vue'
import accessApiCode from '../../assets/access-api.gs?raw'
import CopyFeedback from './ui/CopyFeedback.vue'
import Notification from './ui/Notification.vue'

const copying = ref(false), copied = ref(false), error = ref('')
let resetTimer
const copy = async () => {
    if (copying.value) return
    copying.value = true; copied.value = false; error.value = ''
    clearTimeout(resetTimer)
    try {
        await navigator.clipboard.writeText(accessApiCode)
        copied.value = true
        resetTimer = setTimeout(() => { copied.value = false }, 2000)
    } catch { error.value = 'Не удалось скопировать код. Попробуйте ещё раз.' }
    finally { copying.value = false }
}
onUnmounted(() => clearTimeout(resetTimer))
</script>

<template>
    <div class="grid gap-1 text-xs">
        <p class="text-ui-muted">Для своей таблицы — <button type="button" class="ui-link cursor-pointer underline decoration-ui-accent/40 underline-offset-2 disabled:cursor-wait" :disabled="copying" @click="copy">Скопировать код API</button></p>
        <CopyFeedback :text="copied ? 'Код скопирован' : ''" />
        <Notification v-if="error" :text="error" />
    </div>
</template>

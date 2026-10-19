<script setup>
import { onUnmounted, ref } from 'vue'
import accessApiCode from '../../assets/access-api.gs?raw'

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
        <p role="status" aria-live="polite" :class="error ? 'text-ui-danger' : 'text-ui-success'">{{ error || (copied ? 'Код скопирован' : '') }}</p>
    </div>
</template>

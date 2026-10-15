<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { cancelSiteIcons, loadIconStatus, refreshSiteIcons } from '../data/projectData'
import Button from './ui/Button.vue'

const status = ref({ active: false, total: 0, completed: 0, failed: 0, cached: 0, bytes: 0 })
const busy = ref(false), error = ref(''), largeWarning = ref(false)
const load = async () => {
    try { status.value = await loadIconStatus(); if (status.value.largeWarning) largeWarning.value = true } catch (reason) { error.value = reason.message }
}
const changed = message => { if (message.type === 'icons:changed') load() }
const run = async action => {
    busy.value = true; error.value = ''
    try { await action(); await load() } catch (reason) { error.value = reason.message }
    finally { busy.value = false }
}
const refresh = () => run(refreshSiteIcons)
onMounted(() => {
 chrome.runtime.onMessage.addListener(changed); load() })
onUnmounted(() => chrome.runtime.onMessage.removeListener(changed))
</script>

<template>
    <div class="grid gap-2">
        <div class="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" :disabled="busy || status.active" @click="refresh">Обновить иконки</Button>
            <Button v-if="status.active" variant="ghost" size="sm" :disabled="busy" @click="run(cancelSiteIcons)">Отменить</Button>
            <span v-if="status.active" role="status" class="text-xs text-ui-muted">Иконки: {{ status.completed }} / {{ status.total }}</span>
            <span v-else class="text-xs text-ui-muted/70">В кеше: {{ status.cached }} · {{ (status.bytes / 1024 / 1024).toFixed(1) }} МБ</span>
        </div>
        <progress v-if="status.active" :value="status.completed" :max="status.total || 1" aria-label="Загрузка иконок" class="h-1 w-full accent-sky-400" />
        <p v-if="largeWarning" role="alert" class="text-xs text-ui-warning">Кеш иконок превысил 50 МБ. Это уведомление показывается один раз; загрузка продолжается.</p>
        <p v-if="status.failed" class="text-xs text-ui-warning">Не удалось обновить: {{ status.failed }}. Для них сохраняется прежняя иконка или инициалы.</p>
        <p v-if="error" class="text-xs text-ui-danger">{{ error }}</p>
    </div>
</template>

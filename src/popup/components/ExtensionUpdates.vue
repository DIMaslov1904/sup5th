<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { extensionApi, isFirefox } from '../../platform/extensionApi.js'
import { loadUpdateStatus, checkExtensionUpdate } from '../data/projectData.js'
import { UPDATE_STATE_KEY } from '../../updates/checker.js'
import Button from './ui/Button.vue'
import Card from './ui/Card.vue'
import Message from './ui/Message.vue'

const currentVersion = extensionApi.runtime.getManifest().version
const status = ref(null), loading = ref(true), checking = ref(false), error = ref('')
const browserName = isFirefox ? 'Firefox' : 'Chromium'
const busy = computed(() => checking.value || status.value?.checking)
const date = value => value ? new Date(value).toLocaleString('ru-RU') : 'Ещё не выполнялась'
let alive = true, revision = 0, poll
const show = value => { if (alive) status.value = value }
const load = async () => {
    const current = ++revision
    try {
        const value = await loadUpdateStatus()
        if (alive && current === revision) { show(value); error.value = '' }
    } catch (reason) { if (alive && current === revision) error.value = reason.message }
    finally { if (alive && current === revision) loading.value = false }
}
const check = async () => {
    if (busy.value) return
    checking.value = true; error.value = ''; revision++
    try { show(await checkExtensionUpdate()) }
    catch (reason) { if (alive) error.value = reason.message }
    finally { if (alive) checking.value = false }
}
const changed = (changes, area) => { if (area === 'local' && changes[UPDATE_STATE_KEY]) load() }
onMounted(() => {
    extensionApi.storage.onChanged.addListener(changed)
    load()
    // An already-open popup also observes background checks that end without a storage change.
    poll = setInterval(() => { if (status.value?.checking && !checking.value) load() }, 1000)
})
onUnmounted(() => { alive = false; revision++; clearInterval(poll); extensionApi.storage.onChanged.removeListener(changed) })
</script>

<template>
    <Card title="Обновления расширения">
        <div class="grid gap-4">
            <dl class="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 text-xs">
                <dt class="text-ui-muted">Текущая версия</dt><dd class="text-right font-semibold tabular-nums">{{ currentVersion }}</dd>
                <dt class="text-ui-muted">Последняя проверка</dt><dd class="text-right tabular-nums">{{ loading ? 'Загрузка…' : date(status?.lastCheckedAt) }}</dd>
            </dl>
            <p class="text-xs text-ui-muted">Проверяем раз в сутки при работающем браузере. Источник — GitHub Releases.</p>
            <div role="status" aria-live="polite" class="grid gap-3">
                <Message v-if="error || (status?.error && !busy)" type="error">{{ error || status.error }}</Message>
                <template v-if="status?.updateAvailable">
                    <p class="text-xs font-medium text-ui-accent">Доступна версия {{ status.latestVersion }}</p>
                    <p v-if="status.error && status.lastSuccessfulAt" class="text-xs text-ui-muted">По данным успешной проверки от {{ date(status.lastSuccessfulAt) }}.</p>
                    <p v-if="!status.downloadUrl" class="text-xs text-ui-muted">{{ isFirefox ? 'Подписанный XPI ещё не добавлен в релиз.' : 'Пакет Chromium ещё не добавлен в релиз.' }}</p>
                </template>
                <p v-else-if="status?.lastSuccessfulAt && !status.error && !busy" class="text-xs text-ui-success">Установлена актуальная версия.</p>
            </div>
            <div class="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" :loading="busy" :disabled="loading" @click="check">{{ busy ? 'Проверяем…' : 'Проверить обновление' }}</Button>
                <Button v-if="status?.updateAvailable && status.downloadUrl" size="sm" :href="status.downloadUrl">Скачать для {{ browserName }}</Button>
            </div>
            <p v-if="status?.updateAvailable && status.downloadUrl" class="text-xs text-ui-muted">{{ isFirefox ? 'Установите подписанный XPI через менеджер дополнений Firefox.' : 'Распакуйте ZIP в прежнюю папку расширения и нажмите «Перезагрузить» в менеджере расширений.' }}</p>
        </div>
    </Card>
</template>

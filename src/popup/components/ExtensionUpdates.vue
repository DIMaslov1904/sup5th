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
const extensionsUrl = isFirefox ? 'about:addons'
    : /YaBrowser\//i.test(navigator.userAgent) ? 'browser://extensions/'
    : /Edg\//i.test(navigator.userAgent) ? 'edge://extensions/'
    : /OPR\//i.test(navigator.userAgent) ? 'opera://extensions/' : 'chrome://extensions/'
const downloading = ref(false), copying = ref(false), copied = ref(false), installError = ref('')
const busy = computed(() => checking.value || status.value?.checking)
const date = value => value ? new Date(value).toLocaleString('ru-RU') : 'Ещё не выполнялась'
let alive = true, revision = 0, poll, copyTimer
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
const download = async () => {
    // Firefox keeps the normal XPI link; privileged about: pages cannot be opened through tabs.create.
    if (isFirefox || downloading.value || !status.value?.downloadUrl) return
    downloading.value = true; installError.value = ''
    try {
        await extensionApi.downloads.download({ url: status.value.downloadUrl })
    } catch {
        if (alive) { downloading.value = false; installError.value = 'Не удалось начать скачивание. Попробуйте ещё раз.' }
        return
    }
    try { await extensionApi.tabs.create({ url: extensionsUrl }) }
    catch { if (alive) installError.value = 'Не удалось открыть менеджер расширений. Скопируйте адрес и вставьте его в адресную строку браузера.' }
    finally { if (alive) downloading.value = false }
}
const copyExtensionsUrl = async () => {
    if (copying.value) return
    copying.value = true; copied.value = false; installError.value = ''
    clearTimeout(copyTimer)
    try {
        await navigator.clipboard.writeText(extensionsUrl)
        if (alive) {
            copied.value = true
            copyTimer = setTimeout(() => { copied.value = false }, 2000)
        }
    } catch { if (alive) installError.value = 'Не удалось скопировать адрес. Выделите его ниже и скопируйте вручную.' }
    finally { if (alive) copying.value = false }
}
const changed = (changes, area) => { if (area === 'local' && changes[UPDATE_STATE_KEY]) load() }
onMounted(() => {
    extensionApi.storage.onChanged.addListener(changed)
    load()
    // An already-open popup also observes background checks that end without a storage change.
    poll = setInterval(() => { if (status.value?.checking && !checking.value) load() }, 1000)
})
onUnmounted(() => { alive = false; revision++; clearInterval(poll); clearTimeout(copyTimer); extensionApi.storage.onChanged.removeListener(changed) })
</script>

<template>
    <Card title="Обновления расширения">
        <div class="grid gap-4">
            <dl class="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 text-xs">
                <dt class="text-ui-muted">Текущая версия</dt><dd class="text-right font-semibold tabular-nums">{{ currentVersion }}</dd>
                <dt class="text-ui-muted">Последняя проверка</dt><dd class="text-right tabular-nums">{{ loading ? 'Загрузка…' : date(status?.lastCheckedAt) }}</dd>
            </dl>
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
                <template v-if="status?.updateAvailable && status.downloadUrl">
                    <Button size="sm" :href="isFirefox ? status.downloadUrl : ''" :loading="downloading" @click="download">Скачать для {{ browserName }}</Button>
                    <Button size="sm" variant="secondary" :disabled="copying" :title="extensionsUrl" @click="copyExtensionsUrl">{{ copied ? 'Адрес скопирован' : 'Скопировать адрес расширений' }}</Button>
                </template>
            </div>
            <div v-if="status?.updateAvailable && status.downloadUrl" class="grid gap-2 text-xs text-ui-muted">
                <p>{{ isFirefox ? 'Переместите скачанный XPI в окно браузера. Чтобы открыть менеджер расширений, скопируйте адрес ниже и вставьте его в адресную строку.' : 'После начала скачивания откроется менеджер расширений. Распакуйте ZIP в прежнюю папку расширения и нажмите «Перезагрузить».' }}</p>
                <p>Адрес менеджера расширений: <code class="select-text">{{ extensionsUrl }}</code></p>
                <p role="status" aria-live="polite" :class="installError ? 'text-ui-danger' : 'text-ui-success'">{{ installError || (copied ? 'Адрес скопирован. Вставьте его в адресную строку браузера.' : '') }}</p>
            </div>
        </div>
    </Card>
</template>

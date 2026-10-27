<script setup>
import { extensionApi, isSafari } from '../../platform/extensionApi.js'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { loadApiSettings, loadProjectData, refreshAll, loadErrorLog, clearErrorLog, clearAllData, authorizeProjectsApi, authorizeAccessApi, lockCredentialVault, disableCredentialProtection } from '../data/projectData.js'
import { getBiometricCapabilities } from '../../utils/biometricHello.js'
import { enableCredentialProtection, unlockCredentialProtection } from '../biometricActions.js'
import { securityStatus, refreshJob, refreshSecurityStatus, activeSupportTicket } from '../backgroundState.js'
import { resetActiveSupportTicket } from '../data/projectData.js'
import { ensureUnlocked, BIOMETRIC_ACTION_HANDLED } from '../unlockStore.js'
import Button from '../components/ui/Button.vue'
import Input from '../components/ui/Input.vue'
import Card from '../components/ui/Card.vue'
import Message from '../components/ui/Message.vue'
import Notification from '../components/ui/Notification.vue'
import Tabs from '../components/ui/Tabs.vue'
import Preloader from '../components/ui/Preloader.vue'
import IconCacheControls from '../components/IconCacheControls.vue'
import MaintenanceCard from '../components/MaintenanceCard.vue'
import BiometricProviderHelp from '../components/BiometricProviderHelp.vue'
import { useApiAutosave } from '../useApiAutosave.js'
import CopyAccessApiCode from '../components/CopyAccessApiCode.vue'
import ExtensionUpdates from '../components/ExtensionUpdates.vue'
import { pipelineBadgePreference, setPipelineBadgeEnabled } from '../pipelineBadgeState.js'
import { projectShortcuts, updateProjectShortcuts } from '../projectShortcutsState.js'
import { REFRESH_PERIOD } from '../../utils/dataRefreshPolicy.js'
import { needsApiAuthorization } from '../../utils/apiAuthorizationState.js'

const section = ref('connection'), settings = ref({ projectsUrl: '', accessUrl: '' }), data = ref(null), errors = ref([])
const savedSettings = ref({ projectsUrl: '', accessUrl: '' })
const loaded = ref(false), busy = ref(''), message = ref({ type: 'info', text: '' }), caps = ref({ available: false })
const sections = [['connection','Подключение'],['data','Загрузка'],['security','Защита'],['maintenance','Обслуживание'],['updates','Обновления']]
const snapshot = computed(() => data.value?.lastSuccessfulData)
const needsAuthorization = type => {
    const url = savedSettings.value[type === 'projects' ? 'projectsUrl' : 'accessUrl']
    return Boolean(url) && needsApiAuthorization(data.value, type)
}
const date = value => value ? new Date(value).toLocaleString('ru-RU') : 'Ещё не загружены'
const freshness = type => {
    const time = snapshot.value?.[`${type}UpdatedAt`], url = savedSettings.value[type === 'projects' ? 'projectsUrl' : 'accessUrl']
    if (!url) return 'API не подключён'
    if (!time) return 'Ожидается первая загрузка'
    if (snapshot.value[`${type}Url`] !== url) return 'Источник изменён — загрузите данные'
    return Date.now() - time >= REFRESH_PERIOD ? 'Требуется обновление' : 'Актуально по ежедневному расписанию'
}
let alive = true, revision = 0
const load = async () => {
    const current = ++revision
    const [apiSettings, savedData, savedErrors] = await Promise.all([loadApiSettings(), loadProjectData(), loadErrorLog()])
    if (!alive || current !== revision) return
    // Never overwrite an API address while the user is editing it.
    if (!loaded.value) settings.value = { ...apiSettings }
    savedSettings.value = apiSettings
    data.value = savedData; errors.value = savedErrors; loaded.value = true
}
const changed = (changes, area) => { if (area === 'local' && (changes.projectData || changes.apiErrorLog || changes.apiSettings)) load().catch(showError) }
const showError = error => { if (alive) { message.value = { type: 'error', text: error.message }; loaded.value = true } }
const autosave = useApiAutosave(settings, savedSettings, showError)
const saveLabels = { pending: 'Ожидание сохранения…', saving: 'Сохранение…', saved: 'Сохранено' }
onMounted(() => {
    extensionApi.storage.onChanged.addListener(changed)
    load().catch(showError)
    getBiometricCapabilities().then(value => { if (alive) caps.value = value }).catch(showError)
})
onUnmounted(() => { alive = false; revision++; extensionApi.storage.onChanged.removeListener(changed) })
const run = async (name, action, success = '') => {
    if (busy.value) return
    busy.value = name; message.value.text = ''
    try { await action(); if (alive && success) message.value = { type: 'success', text: success } }
    catch (error) { showError(error) }
    finally { if (alive) busy.value = '' }
}
const loadData = scope => run('load', async () => {
    const saved = scope === 'all' ? await autosave.flushAll() : await autosave.flush(scope === 'projects' ? 'projectsUrl' : 'accessUrl')
    if (!saved) throw new Error('Проверьте адреса API в разделе «Подключение»')
    const action = () => refreshAll({ scope })
    const result = scope !== 'projects' && savedSettings.value.accessUrl ? await ensureUnlocked(action, { refreshAfterUnlock: false, intent: { type: 'refresh', scope } }) : await action()
    data.value = result === BIOMETRIC_ACTION_HANDLED ? await loadProjectData() : result
    errors.value = await loadErrorLog()
    if (data.value.refreshErrors.length) throw new Error(data.value.refreshErrors.join('\n'))
}, 'Данные обновлены')
const authorize = type => run('authorize', async () => {
    if (!await autosave.flush(type === 'projects' ? 'projectsUrl' : 'accessUrl')) return
    return type === 'projects' ? authorizeProjectsApi() : authorizeAccessApi()
})
const enable = () => run('security', async () => { await enableCredentialProtection(); await refreshSecurityStatus() }, 'Биометрическая защита включена')
const unlock = () => run('security', async () => {
    await unlockCredentialProtection(securityStatus.value); await refreshSecurityStatus()
}, 'Хранилище разблокировано')
const lock = () => run('security', async () => { await lockCredentialVault(); await refreshSecurityStatus() })
const disable = () => {
    if (!confirm('Отключить защиту? Пароли будут храниться локально без шифрования.')) return
    run('security', async () => { await disableCredentialProtection(); await refreshSecurityStatus() })
}
const reset = () => {
    if (!confirm('Удалить настройки, доступы, кеш иконок и результаты расширения? Текущая загрузка будет отменена.')) return
    run('reset', async () => { await autosave.cancel(); await clearAllData(); loaded.value = false; await load(); await refreshSecurityStatus() }, 'Данные удалены')
}
</script>
<template>
    <section class="flex min-w-0 flex-1 flex-col gap-4 px-4">
        <Tabs v-model="section" :items="sections" label="Настройки расширения" wrap />
        <ExtensionUpdates v-if="section === 'updates'" />
        <Preloader v-else-if="!loaded" label="Загрузка настроек…" />
        <template v-else>
            <template v-if="section === 'connection'">                
                <Card v-for="[type,title,field] in [['projects','Проекты','projectsUrl'],['accesses','Личные доступы и сервисы','accessUrl']]" :key="type" :title="title">
                    <Input :model-value="settings[field]" :aria-label="`URL API: ${title}`" :aria-invalid="Boolean(autosave.states[field].error)" :aria-describedby="autosave.states[field].status !== 'idle' ? `api-${field}-status` : undefined" placeholder="URL веб-приложения Apps Script" :disabled="Boolean(busy)" @update:model-value="value => autosave.update(field, value)" @blur="autosave.flush(field)" @keydown.enter.prevent="autosave.flush(field)" />
                    <p v-if="autosave.states[field].status !== 'idle'" :id="`api-${field}-status`" role="status" aria-live="polite" class="mt-2 text-xs" :class="autosave.states[field].error ? 'text-ui-danger' : 'text-ui-muted'">{{ autosave.states[field].error || saveLabels[autosave.states[field].status] }}</p>
                    <p v-if="type === 'projects'" class="mt-2 text-xs text-ui-muted">Адрес из таблицы «База знаний 5th».</p>
                    <CopyAccessApiCode v-else class="mt-2" />
                    <Message v-if="data?.[type === 'projects' ? 'projectApiStatus' : 'accessApiStatus']" type="warning" class="mt-2">{{ data[type === 'projects' ? 'projectApiStatus' : 'accessApiStatus'] === 'access_denied' ? 'Доступ к таблице ограничен. Обратитесь к владельцу.' : 'Войдите в Google и подтвердите доступ, затем повторите загрузку.' }}</Message>
                    <Button v-if="needsAuthorization(type)" size="sm" variant="ghost" class="mt-2" :disabled="Boolean(busy)" @click="authorize(type)">Открыть API / авторизацию</Button>
                </Card>
                <Card title="Доп. функции">
                    <label class="mb-3 flex cursor-pointer items-center justify-between gap-3 text-[13px]">
                        <span>Показывать последние проекты</span>
                        <input type="checkbox" role="switch" aria-label="Показывать последние проекты" :checked="projectShortcuts.enabled" :disabled="Boolean(busy)" class="peer sr-only" @change="event => run('shortcuts', () => updateProjectShortcuts({kind:'configure',enabled:event.target.checked}))" />
                        <span aria-hidden="true" class="relative h-5 w-9 shrink-0 rounded-full bg-ui-border transition-colors after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-ui-accent peer-checked:after:translate-x-4 peer-focus-visible:outline-2 peer-focus-visible:outline-ui-accent peer-disabled:opacity-50"></span>
                    </label>
                    <label class="flex cursor-pointer items-center justify-between gap-3 text-[13px]">
                        <span>Показывать статус pipeline в проекте</span>
                        <input type="checkbox" role="switch" :checked="pipelineBadgePreference.enabled" :disabled="!pipelineBadgePreference.ready || Boolean(busy)"
                            aria-describedby="pipeline-badge-help" class="peer sr-only" @change="event => run('pipeline', () => setPipelineBadgeEnabled(event.target.checked))" />
                        <span aria-hidden="true" class="relative h-5 w-9 shrink-0 rounded-full bg-ui-border transition-colors after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-ui-accent peer-checked:after:translate-x-4 peer-focus-visible:outline-2 peer-focus-visible:outline-ui-accent peer-disabled:opacity-50"></span>
                    </label>
                </Card>
            </template>
            <template v-if="section === 'data'">
                <Card title="Загрузка данных">
                    <div class="grid grid-cols-3 gap-2"><Button :disabled="Boolean(busy) || refreshJob.running || (!savedSettings.projectsUrl && !savedSettings.accessUrl)" @click="loadData('all')">Загрузить всё</Button><Button variant="secondary" :disabled="Boolean(busy) || refreshJob.running || !savedSettings.projectsUrl" @click="loadData('projects')">Только проекты</Button><Button variant="secondary" :disabled="Boolean(busy) || refreshJob.running || !savedSettings.accessUrl" @click="loadData('accesses')">Только доступы</Button></div>
                    <p v-if="refreshJob.running" role="status" class="mt-3 flex items-center gap-2 text-xs text-ui-accent"><span class="ui-loading" aria-hidden="true"></span>Загружаем: {{ refreshJob.completed }} / {{ refreshJob.total }}. Можно закрыть popup.</p>
                    <p v-else-if="refreshJob.finishedAt" class="mt-3 text-xs text-ui-muted">Последняя операция: {{ date(refreshJob.finishedAt) }} · {{ refreshJob.state === 'done' ? 'завершена' : refreshJob.state === 'interrupted' ? 'прервана' : 'есть ошибки' }}</p>
                    <Message v-for="text in refreshJob.errors || []" :key="text" type="error" class="mt-2">{{ text }}</Message>
                </Card>
                <Card v-for="[type,title,count] in [['projects','Проекты',snapshot?.projects.length],['accesses','Доступы',snapshot?.accesses.length]]" :key="type" :title="title">
                    <dl class="grid gap-2 text-xs"><div class="flex justify-between gap-3"><dt class="text-ui-muted">Записей</dt><dd>{{ count || 0 }}</dd></div><div class="flex justify-between gap-3"><dt class="text-ui-muted">Последняя успешная загрузка</dt><dd>{{ date(snapshot?.[`${type}UpdatedAt`]) }}</dd></div><div class="flex justify-between gap-3"><dt class="text-ui-muted">Состояние</dt><dd>{{ freshness(type) }}</dd></div></dl>
                </Card>
            </template>
            <Card v-if="section === 'security'" title="Защита паролей">
                <div class="grid gap-3">
                    <p class="text-xs text-ui-muted">{{ securityStatus.enabled ? (securityStatus.unlocked ? 'Хранилище разблокировано.' : 'Хранилище заблокировано.') : 'Защита выключена. Пароли хранятся локально без шифрования.' }}</p>
                    <p v-if="securityStatus.keySource === 'credential-id'" class="text-xs text-ui-muted">Ключ доступа: {{ securityStatus.passkeyName }} · локальный режим совместимости.</p>
                    <p v-if="isSafari" class="text-xs text-ui-muted">В Safari хранилище блокируется через 10 минут после разблокировки и при завершении браузерной сессии. Блокировка экрана отдельно не отслеживается.</p>
                    <Button v-if="!securityStatus.enabled" :disabled="Boolean(busy) || !caps.available" variant="secondary" @click="enable">Включить биометрию устройства</Button>
                    <template v-else><Button v-if="!securityStatus.unlocked" :disabled="Boolean(busy)" @click="unlock">Разблокировать</Button><template v-else><Button variant="secondary" :disabled="Boolean(busy)" @click="lock">Заблокировать</Button><Button variant="danger" :disabled="Boolean(busy)" @click="disable">Отключить защиту</Button></template></template>
                    <p v-if="!caps.available" class="text-xs text-ui-warning">WebAuthn недоступен в этом браузере.</p>
                    <BiometricProviderHelp v-if="!securityStatus.enabled" />
                </div>
            </Card>
            <template v-if="section === 'maintenance'">
                <MaintenanceCard title="Текущий тикет">
                    <p v-if="activeSupportTicket">№{{ activeSupportTicket.ticketId }} · Отсчёт с {{ date(activeSupportTicket.startedAt) }}</p>
                    <p v-else>Нет тикета в работе.</p>
                    <template #actions>
                        <Button size="sm" variant="secondary" :disabled="Boolean(busy) || !activeSupportTicket"
                            @click="run('ticket', resetActiveSupportTicket, 'Тикет сброшен')">Сбросить тикет</Button>
                    </template>
                </MaintenanceCard>
                <IconCacheControls />
                <MaintenanceCard title="Журнал ошибок">
                    <p v-if="!errors.length">Ошибок загрузки нет.</p>
                    <ul v-else class="grid gap-3"><li v-for="(error,index) in errors" :key="index">{{ date(error.createdAt) }} · {{ error.message }}</li></ul>
                    <template #actions>
                        <Button size="sm" variant="secondary" :disabled="Boolean(busy) || !errors.length" @click="run('errors',async () => { await clearErrorLog(); errors = [] })">Очистить журнал</Button>
                    </template>
                </MaintenanceCard>
                <MaintenanceCard title="Сброс данных">
                    <p>Удалить настройки, доступы, кеш иконок и результаты расширения.</p>
                    <template #actions>
                        <Button variant="danger" size="sm" :disabled="Boolean(busy)" @click="reset">Сбросить все данные</Button>
                    </template>
                </MaintenanceCard>
            </template>
            <Notification v-if="message.text" :type="message.type" :text="message.text" />
        </template>
    </section>
</template>

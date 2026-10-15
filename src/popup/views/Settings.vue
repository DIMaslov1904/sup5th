<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { loadApiSettings, saveApiSettings, loadProjectData, refreshAll, loadErrorLog, clearErrorLog, clearAllData, authorizeProjectsApi, authorizeAccessApi, enableHelloProtection, unlockCredentialVaultWithHello, lockCredentialVault, disableCredentialProtection } from '../data/projectData.js'
import { getBiometricCapabilities, enableBiometricProtectionFlow, unlockWithBiometricFlow } from '../../utils/biometricHello.js'
import { securityStatus, refreshJob, refreshSecurityStatus } from '../backgroundState.js'
import { ensureUnlocked } from '../unlockStore.js'
import Button from '../components/ui/Button.vue'
import Input from '../components/ui/Input.vue'
import Card from '../components/ui/Card.vue'
import Message from '../components/ui/Message.vue'
import Tabs from '../components/ui/Tabs.vue'
import Preloader from '../components/ui/Preloader.vue'
import IconCacheControls from '../components/IconCacheControls.vue'

const section = ref('connection'), settings = ref({ projectsUrl: '', accessUrl: '' }), data = ref(null), errors = ref([])
const savedSettings = ref({ projectsUrl: '', accessUrl: '' })
const loaded = ref(false), busy = ref(''), message = ref({ type: 'info', text: '' }), caps = ref({ helloAvailable: false, prf: false })
const sections = [['connection','Подключение'],['data','Загрузка'],['security','Защита'],['maintenance','Обслуживание']]
const version = chrome.runtime.getManifest().version
const optionsUrl = chrome.runtime.getURL('src/options/index.html')
const snapshot = computed(() => data.value?.lastSuccessfulData)
const needsAuthorization = type => {
    const url = savedSettings.value[type === 'projects' ? 'projectsUrl' : 'accessUrl']
    const status = data.value?.[type === 'projects' ? 'projectApiStatus' : 'accessApiStatus']
    return Boolean(url) && (['login_required', 'authorization_needed'].includes(status) || (type === 'accesses' && data.value?.accessAuthRequired))
}
const date = value => value ? new Date(value).toLocaleString('ru-RU') : 'Ещё не загружены'
const freshness = type => {
    const time = snapshot.value?.[`${type}UpdatedAt`], url = savedSettings.value[type === 'projects' ? 'projectsUrl' : 'accessUrl']
    if (!url) return 'API не подключён'
    if (!time) return 'Ожидается первая загрузка'
    if (snapshot.value[`${type}Url`] !== url) return 'Источник изменён — загрузите данные'
    return Date.now() - time >= 7 * 86400000 ? 'Требуется обновление' : 'Актуально по недельному расписанию'
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
onMounted(() => {
    chrome.storage.onChanged.addListener(changed)
    load().catch(showError)
    getBiometricCapabilities().then(value => { if (alive) caps.value = value }).catch(showError)
})
onUnmounted(() => { alive = false; revision++; chrome.storage.onChanged.removeListener(changed) })
const run = async (name, action, success = '') => {
    if (busy.value) return
    busy.value = name; message.value.text = ''
    try { await action(); if (alive && success) message.value = { type: 'success', text: success } }
    catch (error) { showError(error) }
    finally { if (alive) busy.value = '' }
}
const save = type => run('save', async () => {
    const field = type === 'projects' ? 'projectsUrl' : 'accessUrl'
    const result = await saveApiSettings({ [field]: settings.value[field] })
    savedSettings.value = result
    settings.value[field] = result[field]
}, 'Адрес API сохранён')
const loadData = scope => run('load', async () => {
    const action = () => refreshAll({ scope })
    data.value = scope !== 'projects' && savedSettings.value.accessUrl ? await ensureUnlocked(action, { refreshAfterUnlock: false }) : await action()
    errors.value = await loadErrorLog()
    if (data.value.refreshErrors.length) throw new Error(data.value.refreshErrors.join('\n'))
}, 'Данные обновлены')
const authorize = type => run('authorize', () => type === 'projects' ? authorizeProjectsApi() : authorizeAccessApi())
const enable = () => run('security', async () => { await enableHelloProtection(await enableBiometricProtectionFlow()); await refreshSecurityStatus() }, 'Биометрическая защита включена')
const unlock = () => run('security', async () => {
    const { key } = await unlockWithBiometricFlow(securityStatus.value)
    await unlockCredentialVaultWithHello(key); await refreshSecurityStatus()
}, 'Хранилище разблокировано')
const lock = () => run('security', async () => { await lockCredentialVault(); await refreshSecurityStatus() })
const disable = () => {
    if (!confirm('Отключить защиту? Пароли будут храниться локально без шифрования.')) return
    run('security', async () => { await disableCredentialProtection(); await refreshSecurityStatus() })
}
const reset = () => {
    if (!confirm('Удалить настройки, доступы, кеш иконок и результаты расширения? Текущая загрузка будет отменена.')) return
    run('reset', async () => { await clearAllData(); loaded.value = false; await load(); await refreshSecurityStatus() }, 'Данные удалены')
}
</script>
<template>
    <section class="flex min-w-0 flex-1 flex-col gap-4 px-4">
        <Tabs v-model="section" :items="sections" label="Настройки расширения" wrap />
        <Preloader v-if="!loaded" label="Загрузка настроек…" />
        <template v-else>
            <template v-if="section === 'connection'">
                <Card v-for="[type,title,field] in [['projects','Проекты','projectsUrl'],['accesses','Личные доступы и сервисы','accessUrl']]" :key="type" :title="title">
                    <form class="flex gap-2" @submit.prevent="save(type)"><Input v-model="settings[field]" :aria-label="`URL API: ${title}`" placeholder="URL веб-приложения Apps Script" :disabled="Boolean(busy)" /><Button type="submit" variant="secondary" :disabled="Boolean(busy)">Сохранить</Button></form>
                    <p v-if="type === 'projects'" class="mt-2 text-xs text-ui-muted">Адрес из таблицы «База знаний 5th».</p>
                    <p v-else class="mt-2 text-xs text-ui-muted">Как получить адрес API — <a :href="optionsUrl" target="_blank" rel="noreferrer" class="hover:text-ui-accent text-white/70 underline decoration-sky-300/40 underline-offset-2">инструкция</a></p>
                    <Message v-if="data?.[type === 'projects' ? 'projectApiStatus' : 'accessApiStatus']" type="warning" class="mt-2">{{ data[type === 'projects' ? 'projectApiStatus' : 'accessApiStatus'] === 'access_denied' ? 'Доступ к таблице ограничен. Обратитесь к владельцу.' : 'Войдите в Google и подтвердите доступ, затем повторите загрузку.' }}</Message>
                    <Button v-if="needsAuthorization(type)" size="sm" variant="ghost" class="mt-2" :disabled="Boolean(busy)" @click="authorize(type)">Открыть API / авторизацию</Button>
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
                <p class="text-xs text-ui-muted">Плановое обновление — раз в неделю. Заблокированные доступы обновляются после разблокировки.</p>
            </template>
            <Card v-if="section === 'security'" title="Защита паролей">
                <div class="grid gap-3">
                    <p class="text-xs text-ui-muted">{{ securityStatus.enabled ? (securityStatus.unlocked ? 'Хранилище разблокировано.' : 'Хранилище заблокировано.') : 'Защита выключена. Пароли хранятся локально без шифрования.' }}</p>
                    <Button v-if="!securityStatus.enabled" :disabled="Boolean(busy) || !caps.helloAvailable" variant="secondary" @click="enable">Включить биометрию устройства</Button>
                    <template v-else><Button v-if="!securityStatus.unlocked" :disabled="Boolean(busy)" @click="unlock">Разблокировать</Button><template v-else><Button variant="secondary" :disabled="Boolean(busy)" @click="lock">Заблокировать</Button><Button variant="danger" :disabled="Boolean(busy)" @click="disable">Отключить защиту</Button></template></template>
                    <p v-if="!caps.helloAvailable" class="text-xs text-ui-warning">Системный аутентификатор недоступен. Для Windows настройте Windows Hello.</p>
                    <p v-else-if="!caps.prf" class="text-xs text-ui-warning">Поддержка PRF не подтверждена. При включении проверим её на устройстве.</p>
                    <p class="text-xs text-ui-muted">Автоблокировка: 10 минут без ввода на устройстве, блокировка экрана или завершение сессии браузера.</p>
                </div>
            </Card>
            <template v-if="section === 'maintenance'">
                <Card title="Иконки сайтов"><IconCacheControls /></Card>
                <Card title="Журнал ошибок"><p v-if="!errors.length" class="text-xs text-ui-muted">Ошибок загрузки нет.</p><ul v-else class="grid gap-3 text-xs"><li v-for="(error,index) in errors" :key="index"><span class="text-ui-muted">{{ date(error.createdAt) }}</span> · {{ error.message }}</li></ul><Button size="sm" variant="secondary" class="mt-3" :disabled="Boolean(busy) || !errors.length" @click="run('errors',async () => { await clearErrorLog(); errors = [] })">Очистить журнал</Button></Card>
                <Button variant="danger" size="sm" :disabled="Boolean(busy)" @click="reset">Сбросить все данные</Button>
            </template>
            <Message v-if="message.text" :type="message.type" class="whitespace-pre-line">{{ message.text }}</Message>
        </template>
        <p class="mt-auto text-right text-[11px] text-ui-muted/70">Версия {{ version }}</p>
    </section>
</template>

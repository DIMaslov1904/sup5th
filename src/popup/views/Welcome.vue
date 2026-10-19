<script setup>
import { computed, onMounted, ref } from 'vue'
import { saveApiSettings, refreshAll, authorizeProjectsApi, authorizeAccessApi } from '../data/projectData.js'
import { getBiometricCapabilities } from '../../utils/biometricHello.js'
import { enableCredentialProtection } from '../biometricActions.js'
import { securityStatus, refreshSecurityStatus, refreshJob } from '../backgroundState.js'
import { ensureUnlocked, BIOMETRIC_ACTION_HANDLED } from '../unlockStore.js'
import Button from '../components/ui/Button.vue'
import Input from '../components/ui/Input.vue'
import Card from '../components/ui/Card.vue'
import Message from '../components/ui/Message.vue'
import Notification from '../components/ui/Notification.vue'
import BiometricProviderHelp from '../components/BiometricProviderHelp.vue'
import CopyAccessApiCode from '../components/CopyAccessApiCode.vue'

const props = defineProps({ step: { type: String, required: true }, settings: { type: Object, required: true } })
const emit = defineEmits(['completed'])
const projectsUrl = ref(props.settings.projectsUrl || ''), accessUrl = ref(props.settings.accessUrl || '')
const busy = ref(false), error = ref(''), apiFailed = ref(false), capabilities = ref(null)
const stepNumber = computed(() => ['projects', 'security', 'accesses'].indexOf(props.step) + 1)
const run = async action => {
    if (busy.value) return
    busy.value = true; error.value = ''
    try { await action() } catch (reason) { error.value = reason.message }
    finally { busy.value = false }
}
const advance = async step => {
    await saveApiSettings({ setupStep: step })
    apiFailed.value = false
    if (step === 'done') emit('completed')
}
const connect = scope => run(async () => {
    apiFailed.value = false
    const field = scope === 'projects' ? 'projectsUrl' : 'accessUrl'
    const value = scope === 'projects' ? projectsUrl.value : accessUrl.value
    if (!value.trim()) throw new Error('Укажите адрес API')
    await saveApiSettings({ [field]: value, setupStep: props.step })
    try {
        const load = () => refreshAll({ scope })
        const result = scope === 'accesses' ? await ensureUnlocked(load, { refreshAfterUnlock: false, intent: { type: 'refresh', scope, setupStep: 'done' } }) : await load()
        if (result !== BIOMETRIC_ACTION_HANDLED && result.refreshErrors?.length) throw new Error(result.refreshErrors.join('\n'))
    } catch (reason) { apiFailed.value = true; throw reason }
    await advance(scope === 'projects' ? 'security' : 'done')
})
const enable = () => run(async () => {
    await enableCredentialProtection({ advanceSetup: true })
    await refreshSecurityStatus()
    await advance('accesses')
})
const authorize = () => run(() => props.step === 'projects' ? authorizeProjectsApi() : authorizeAccessApi())
onMounted(async () => {
    try { capabilities.value = await getBiometricCapabilities() }
    catch { capabilities.value = { helloAvailable: false } }
})
</script>
<template>
    <main class="ui-background flex h-full flex-col overflow-y-auto px-6 py-7 text-ui-text">
        <header class="mb-6"><p class="text-xs font-semibold tracking-wider text-ui-accent">SUP 5th · Настройка</p><h1 class="mt-2 text-xl font-semibold">{{ step === 'projects' ? 'Добро пожаловать' : step === 'security' ? 'Защитите доступы' : 'Личные доступы и сервисы' }}</h1><p class="mt-2 text-xs text-ui-muted">Шаг {{ stepNumber }} из 3</p></header>
        <ol aria-label="Этапы настройки" class="mb-6 grid grid-cols-3 gap-2 text-xs">
            <li v-for="(label,index) in ['Проекты','Биометрия','Доступы']" :key="label" :aria-current="stepNumber === index + 1 ? 'step' : undefined" class="border-t-2 pt-2" :class="stepNumber >= index + 1 ? 'border-ui-accent text-ui-text' : 'border-ui-border text-ui-muted'">{{ label }}</li>
        </ol>
        <Card v-if="step === 'projects'" title="Подключите API проектов">
            <p class="mb-4 text-xs text-ui-muted">Это обязательный шаг. Возьмите адрес API из таблицы «База знаний 5th». Мы проверим подключение и загрузим проекты.</p>
            <form class="grid gap-3" @submit.prevent="connect('projects')">
                <label for="setup-projects" class="text-xs text-ui-muted">API проектов</label>
                <Input id="setup-projects" v-model="projectsUrl" type="url" required placeholder="https://script.google.com/macros/s/…/exec" :disabled="busy" />
                <Button type="submit" :loading="busy" :disabled="refreshJob.running">Подключить проекты</Button>
            </form>
        </Card>
        <Card v-else-if="step === 'security'" title="Биометрия устройства">
            <div class="grid gap-4">
                <p class="text-xs text-ui-muted">Биометрия защищает сохранённые пароли. Настройку можно пропустить и вернуться к ней позже в разделе «Защита».</p>
                <Message v-if="securityStatus.enabled" type="success">Биометрическая защита уже включена.</Message>
                <template v-else>
                    <Button :loading="busy" :disabled="!capabilities?.available" @click="enable">Настроить биометрию</Button>
                    <p v-if="capabilities && !capabilities.available" class="text-xs text-ui-muted">{{ capabilities.unavailableReason || 'WebAuthn сейчас недоступен. Этот шаг можно пропустить.' }}</p>
                    <BiometricProviderHelp />
                </template>
                <Button variant="ghost" :disabled="busy" @click="run(() => advance('accesses'))">{{ securityStatus.enabled ? 'Далее' : 'Пропустить' }}</Button>
            </div>
        </Card>
        <Card v-else title="Подключите API доступов">
            <p class="mb-4 text-xs text-ui-muted">Добавьте адрес API личных доступов и сервисов. Этот шаг необязательный.</p>
            <form class="grid gap-3" @submit.prevent="connect('accesses')">
                <label for="setup-accesses" class="text-xs text-ui-muted">API личных доступов и сервисов</label>
                <Input id="setup-accesses" v-model="accessUrl" type="url" required placeholder="https://script.google.com/macros/s/…/exec" :disabled="busy" />
                <CopyAccessApiCode />
                <Button type="submit" :loading="busy" :disabled="refreshJob.running">Подключить и завершить</Button>
                <Button variant="ghost" :disabled="busy" @click="run(() => advance('done'))">Пропустить и завершить</Button>
            </form>
        </Card>
        <p v-if="refreshJob.running" role="status" class="mt-3 text-xs text-ui-accent">Загрузка данных: {{ refreshJob.completed }} / {{ refreshJob.total }}</p>
        <Button v-if="apiFailed && step !== 'security'" variant="secondary" class="mt-3" :disabled="busy" @click="authorize">Открыть API / авторизацию</Button>
        <Button v-if="step !== 'projects'" variant="ghost" class="mt-4 self-start" :disabled="busy" @click="run(() => advance(step === 'accesses' ? 'security' : 'projects'))">← Назад</Button>
        <Notification v-if="error" :text="error" />
    </main>
</template>

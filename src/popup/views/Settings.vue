<script setup>
import { computed, onMounted, ref } from 'vue'
import {
    clearAllData,
    disableCredentialProtection,
    enableHelloProtection,
    enablePinProtection,
    getCredentialSecurityStatus,
    loadApiSettings,
    loadErrorLog,
    loadProjectData,
    lockCredentialVault,
    refreshAccesses,
    refreshProjects,
    saveApiSettings,
    unlockCredentialVault,
    unlockCredentialVaultWithHello
} from '../data/projectData'
import {
    enableBiometricProtectionFlow,
    getBiometricCapabilities,
    unlockWithBiometricFlow
} from '../../utils/biometricHello'
import Button from '../components/ui/Button.vue'
import Input from '../components/ui/Input.vue'
import Card from '../components/ui/Card.vue'
import Message from '../components/ui/Message.vue'

const optionsUrl = chrome.runtime.getURL('src/options/index.html')

const settings = ref({ projectsUrl: '', accessUrl: '' })
const data = ref({ lastSuccessfulData: { projects: [], accesses: [], projectsUpdatedAt: null, accessesUpdatedAt: null } })
const errors = ref([])
const loading = ref('')
const securityLoading = ref(false)
const security = ref({ enabled: false, mode: 'off', unlocked: true, helloAvailable: false, prfSupported: false, wrappedKey: null })
const pin = ref('')
const pinConfirm = ref('')
const unlockPin = ref('')
const message = ref({ type: 'error', text: '' })
const helloAvailable = ref(false)
const prfSupported = ref(false)

const successfulData = computed(() => data.value.lastSuccessfulData)

const formatDate = (value) => value ? new Date(value).toLocaleString() : ''

const mergeSecurity = (result) => ({
    ...result,
    helloAvailable: helloAvailable.value,
    prfSupported: prfSupported.value
})

onMounted(async () => {
    try {
        const caps = await getBiometricCapabilities()
        helloAvailable.value = caps.helloAvailable
        prfSupported.value = caps.prf
        const [savedSettings, savedData, savedErrors, savedSecurity] = await Promise.all([
            loadApiSettings(),
            loadProjectData(),
            loadErrorLog(),
            getCredentialSecurityStatus(helloAvailable.value, prfSupported.value)
        ])
        settings.value = savedSettings
        data.value = savedData
        errors.value = savedErrors
        security.value = mergeSecurity(savedSecurity)
    } catch (error) {
        message.value = { type: 'error', text: error.message }
    }
})

const enableProtection = async () => {
    message.value = { type: 'error', text: '' }
    if (pin.value !== pinConfirm.value) {
        message.value = { type: 'error', text: 'PIN-коды не совпадают' }
        return
    }
    securityLoading.value = true
    try {
        security.value = mergeSecurity(await enablePinProtection(pin.value))
        pin.value = ''
        pinConfirm.value = ''
        message.value = { type: 'success', text: 'Локальная защита включена' }
    } catch (error) {
        message.value = { type: 'error', text: error.message }
    } finally {
        securityLoading.value = false
    }
}

const enableHelloProtectionFn = async () => {
    securityLoading.value = true
    message.value = { type: 'error', text: '' }
    try {
        const payload = await enableBiometricProtectionFlow()
        security.value = mergeSecurity(await enableHelloProtection(payload))
        message.value = { type: 'success', text: 'Windows Hello включён. Хранилище защищено биометрией.' }
    } catch (error) {
        message.value = { type: 'error', text: error.message }
    } finally {
        securityLoading.value = false
    }
}

const unlockProtection = async () => {
    securityLoading.value = true
    message.value = { type: 'error', text: '' }
    try {
        security.value = mergeSecurity(await unlockCredentialVault(unlockPin.value))
        unlockPin.value = ''
        message.value = { type: 'success', text: 'Хранилище разблокировано' }
    } catch (error) {
        message.value = { type: 'error', text: error.message }
    } finally {
        securityLoading.value = false
    }
}

const unlockWithHello = async () => {
    securityLoading.value = true
    message.value = { type: 'error', text: '' }
    try {
        const { key } = await unlockWithBiometricFlow({
            credentialId: security.value.credentialId,
            prfSalt: security.value.prfSalt,
            wrappedKey: security.value.wrappedKey
        })
        security.value = mergeSecurity(await unlockCredentialVaultWithHello(key))
        message.value = { type: 'success', text: 'Хранилище разблокировано' }
    } catch (error) {
        message.value = { type: 'error', text: error.message }
    } finally {
        securityLoading.value = false
    }
}

const lockProtection = async () => {
    securityLoading.value = true
    try {
        security.value = mergeSecurity(await lockCredentialVault())
        message.value = { type: 'success', text: 'Хранилище заблокировано' }
    } catch (error) {
        message.value = { type: 'error', text: error.message }
    } finally {
        securityLoading.value = false
    }
}

const disableProtection = async () => {
    if (!window.confirm('Отключить защиту и снова хранить пароли в обычном локальном хранилище расширения?')) return
    securityLoading.value = true
    try {
        security.value = mergeSecurity(await disableCredentialProtection())
        message.value = { type: 'success', text: 'Защита отключена' }
    } catch (error) {
        message.value = { type: 'error', text: error.message }
    } finally {
        securityLoading.value = false
    }
}

const checkApi = async (type) => {
    const urlKey = type === 'projects' ? 'projectsUrl' : 'accessUrl'
    loading.value = type
    message.value = { type: 'error', text: '' }
    try {
        await saveApiSettings(settings.value)
        data.value = type === 'projects'
            ? await refreshProjects(settings.value[urlKey])
            : await refreshAccesses(settings.value[urlKey])
        errors.value = await loadErrorLog()
        message.value = {
            type: 'success',
            text: type === 'projects'
                ? `Загружено проектов: ${data.value.lastSuccessfulData.projects.length}`
                : `Загружено доступов: ${data.value.lastSuccessfulData.accesses.length}`
        }
    } catch (error) {
        message.value = { type: 'error', text: error.message }
    } finally {
        loading.value = ''
    }
}

const resetData = async () => {
    if (!window.confirm('Удалить все данные расширения? Это действие нельзя отменить.')) return

    loading.value = 'reset'
    message.value = { type: 'error', text: '' }
    try {
        await clearAllData()
        settings.value = { projectsUrl: '', accessUrl: '' }
        data.value = { lastSuccessfulData: { projects: [], accesses: [], projectsUpdatedAt: null, accessesUpdatedAt: null, projectsUrl: '', accessesUrl: '' } }
        errors.value = []
        message.value = { type: 'success', text: 'Все данные расширения удалены' }
    } catch (error) {
        message.value = { type: 'error', text: error.message }
    } finally {
        loading.value = ''
    }
}
</script>

<template>
    <div class="grid gap-5 w-full px-4">
        <Card title="API получения всех проектов">
            <div class="flex gap-1">
                <Input v-model="settings.projectsUrl" placeholder="URL веб-приложения Apps Script"
                    :disabled="loading === 'projects'" />
                <Button variant="secondary" :disabled="loading === 'projects'" @click="checkApi('projects')">
                    {{ loading === 'projects' ? 'Загрузка...' : 'Загрузить' }}
                </Button>
            </div>
            <p class="flex items-start mt-2 text-xs text-slate-400">
                Общий url. Указан в таблице База знаний 5th
            </p>
        </Card>

        <Card title="API получения личных доступов">
            <div class="flex gap-1">
                <Input v-model="settings.accessUrl" placeholder="URL веб-приложения Apps Script"
                    :disabled="loading === 'access'" />
                <Button variant="secondary" :disabled="loading === 'access'" @click="checkApi('access')">
                    {{ loading === 'access' ? 'Загрузка...' : 'Загрузить' }}
                </Button>
            </div>
            <p class="flex items-start mt-2 text-xs text-slate-400">
                Инструкция по получению -
                <a :href="optionsUrl" target="_blank" rel="noreferrer"
                    class="hover:text-sky-300 text-white/70 underline decoration-sky-300/40 underline-offset-2">инструкция</a>
            </p>
        </Card>

        <Card title="Защита паролей">
            <div v-if="!security.enabled" class="grid gap-3">
                <p class="text-xs text-slate-300">Защита выключена. При включении логины, пароли и FTP-доступы будут зашифрованы локальным ключом.</p>

                <label class="flex items-center gap-2 text-sm text-slate-200">
                    <input type="radio" checked disabled class="accent-sky-500" />
                    PIN-код
                </label>
                <Input v-model="pin" type="password" inputmode="numeric" autocomplete="new-password"
                    maxlength="12" placeholder="PIN, 8–12 цифр" :disabled="securityLoading" />
                <Input v-model="pinConfirm" type="password" inputmode="numeric" autocomplete="new-password"
                    maxlength="12" placeholder="Повторите PIN" :disabled="securityLoading" />
                <Button variant="secondary" :disabled="securityLoading || !pin || !pinConfirm" @click="enableProtection">
                    {{ securityLoading ? 'Включение...' : 'Включить защиту' }}
                </Button>
                <p class="text-xs text-amber-300">PIN нельзя восстановить. Копия профиля Chrome позволяет атаковать короткий PIN офлайн; рекомендуются 10–12 цифр. Потеря PIN означает потерю доступа к сохранённым секретам.</p>

                <div class="border-t border-white/10 pt-3 grid gap-3">
                    <label class="flex items-center gap-2 text-sm text-slate-200">
                        <input type="radio" checked disabled class="accent-sky-500" />
                        Windows Hello (биометрия)
                    </label>
                    <Button variant="secondary" :disabled="securityLoading || !security.helloAvailable"
                        @click="enableHelloProtectionFn">
                        {{ securityLoading ? 'Включение...' : 'Включить вход по Windows Hello' }}
                    </Button>
                    <p v-if="!security.helloAvailable" class="text-xs text-amber-300">
                        Windows Hello недоступен на этом устройстве. Он появится в Chrome на Windows 10/11 с настроенной биометрией или PIN.
                    </p>
                    <p v-else-if="!security.prfSupported" class="text-xs text-amber-300">
                        Chrome не подтверждает PRF-расширение для passkey. Попробуйте включить — если браузер не выдаст секрет, включите «Создавать passkey в Windows Hello» в chrome://settings/passkeys и удалите лишние passkey этого расширения.
                    </p>
                    <p v-else class="text-xs text-slate-400">
                        Будет создан passkey, привязанный к Windows Hello (PIN / отпечаток / лицо). Ключ хранилища шифруется секретом passkey и не покидает систему.
                    </p>
                </div>
            </div>
            <div v-else class="grid gap-3">
                <div class="flex items-center justify-between gap-3 text-sm">
                    <span>{{ security.mode === 'hello' ? 'Windows Hello' : 'PIN-защита' }}</span>
                    <span :class="security.unlocked ? 'text-emerald-300' : 'text-amber-300'">
                        {{ security.unlocked ? 'Разблокировано' : 'Заблокировано' }}
                    </span>
                </div>

                <template v-if="security.mode === 'hello'">
                    <form v-if="!security.unlocked" @submit.prevent="unlockWithHello">
                        <Button type="submit" variant="secondary" :disabled="securityLoading">
                            {{ securityLoading ? 'Ожидание Windows Hello...' : 'Разблокировать Windows Hello' }}
                        </Button>
                    </form>
                    <div v-else class="flex flex-wrap gap-2">
                        <Button variant="secondary" size="sm" :disabled="securityLoading" @click="lockProtection">Заблокировать</Button>
                        <Button variant="danger" size="sm" :disabled="securityLoading" @click="disableProtection">Отключить защиту</Button>
                    </div>
                    <p class="text-xs text-slate-400">Хранилище автоматически блокируется через 15 минут. Для разблокировки потребуется Windows Hello.</p>
                </template>

                <template v-else>
                    <form v-if="!security.unlocked" class="flex gap-2" @submit.prevent="unlockProtection">
                        <Input v-model="unlockPin" type="password" inputmode="numeric" autocomplete="current-password"
                            maxlength="12" placeholder="PIN-код" :disabled="securityLoading" />
                        <Button type="submit" variant="secondary" :disabled="securityLoading || !unlockPin">
                            {{ securityLoading ? '...' : 'Разблокировать' }}
                        </Button>
                    </form>
                    <div v-else class="flex flex-wrap gap-2">
                        <Button variant="secondary" size="sm" :disabled="securityLoading" @click="lockProtection">Заблокировать</Button>
                        <Button variant="danger" size="sm" :disabled="securityLoading" @click="disableProtection">Отключить защиту</Button>
                    </div>
                    <p class="text-xs text-slate-400">Хранилище автоматически блокируется через 15 минут. PIN не синхронизируется и не имеет восстановления.</p>
                </template>
            </div>
        </Card>

        <Message v-if="message.text" :type="message.type">{{ message.text }}</Message>

        <details v-if="errors.length" class="rounded border border-white/10 bg-slate-900/30 p-3 text-xs text-slate-300">
            <summary class="cursor-pointer">Журнал ошибок ({{ errors.length }})</summary>
            <ul class="mt-2 grid gap-2">
                <li v-for="error in errors.slice(0, 10)" :key="`${error.createdAt}-${error.type}`">
                    <span class="text-slate-500">{{ formatDate(error.createdAt) }}</span>
                    {{ error.type === 'projects' ? 'Проекты' : 'Доступы' }}: {{ error.message }}
                </li>
            </ul>
        </details>

        <Button variant="danger" size="sm" class="mt-8 justify-self-start" :disabled="loading.length" @click="resetData">
            Сбросить все данные
        </Button>
    </div>
</template>

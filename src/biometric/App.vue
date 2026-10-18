<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { extensionApi } from '../platform/extensionApi.js'
import { biometricPageCall } from '../utils/biometricPage.js'
import { enableBiometricProtectionFlow, unlockWithBiometricFlow } from '../utils/biometricHello.js'
import { getCredentialSecurityStatus } from '../popup/data/projectData.js'
import Button from '../popup/components/ui/Button.vue'
import Message from '../popup/components/ui/Message.vue'
import BiometricProviderHelp from '../popup/components/BiometricProviderHelp.vue'

const id = new URL(location.href).searchParams.get('request')
const flow = ref(null), busy = ref(false), done = ref(false), error = ref(''), copied = ref(false), action = ref(null)
let controller, copyValue = ''
onMounted(async () => { try { flow.value = await biometricPageCall('get', { id }); if (flow.value.state !== 'pending') throw new Error('Этот запрос уже завершён. Откройте новый запрос из расширения.') } catch (reason) { error.value = reason.message; flow.value = null } })
onBeforeUnmount(() => { controller?.abort(); copyValue = '' })
const copy = async () => { try { await navigator.clipboard.writeText(copyValue); copyValue = ''; copied.value = true } catch { error.value = 'Не удалось скопировать. Нажмите «Копировать».' } }
const run = async () => {
    if (busy.value || !flow.value || done.value) return
    busy.value = true; error.value = ''; controller = new AbortController()
    try {
        let payload
        if (flow.value.mode === 'enable') payload = { protection: await enableBiometricProtectionFlow({ signal: controller.signal }) }
        else payload = await unlockWithBiometricFlow({ ...await getCredentialSecurityStatus(), signal: controller.signal })
        controller.signal.throwIfAborted()
        const response = await biometricPageCall('complete', { id, ...payload })
        done.value = true; action.value = response.action
        if (response.action.kind === 'copy') { copyValue = response.action.value; delete response.action.value; await copy() }
        if (response.action.kind === 'error') error.value = response.action.error
    } catch (reason) { error.value = reason.name === 'AbortError' || reason.name === 'NotAllowedError' ? 'Проверка устройства отменена или не завершена. Можно повторить.' : reason.message }
    finally { busy.value = false }
}
const leave = async () => {
    controller?.abort()
    if (!done.value && flow.value) await biometricPageCall('cancel', { id }).catch(() => {})
    const current = await extensionApi.tabs.getCurrent()
    if (flow.value?.returnTabId && action.value?.kind !== 'auth') {
        await extensionApi.tabs.update(flow.value.returnTabId, { active: true }).catch(() => {})
        await extensionApi.action.openPopup().catch(() => {})
    }
    if (current?.id) await extensionApi.tabs.remove(current.id)
}
</script>
<template>
    <main class="ui-background flex min-h-dvh items-center justify-center p-6 text-ui-text">
        <section class="ui-panel grid w-full max-w-lg gap-4 p-6" aria-labelledby="biometric-title">
            <p class="text-xs text-ui-muted">SUP 5th</p>
            <h1 id="biometric-title" class="text-xl font-semibold">{{ done ? (flow?.mode === 'enable' ? 'Защита включена' : 'Хранилище разблокировано') : flow?.mode === 'enable' ? 'Включение защиты' : 'Проверка устройства' }}</h1>
            <p v-if="busy" role="status" class="flex items-center gap-2 text-ui-accent"><span class="ui-loading" aria-hidden="true"></span>Подтвердите вход на устройстве…</p>
            <p v-else-if="done && copied" role="status" class="text-ui-success">Скопировано в буфер обмена.</p>
            <p v-else-if="done && action?.kind === 'auth'" role="status">Вход на сайт продолжен.</p>
            <p v-else-if="done && action?.kind === 'refresh'" role="status">Данные обновлены.</p>
            <BiometricProviderHelp v-if="flow?.mode === 'enable' && !done" />
            <Message v-if="error" type="error">{{ error }}</Message>
            <div class="flex flex-wrap justify-end gap-2">
                <Button v-if="flow && !done" :disabled="busy" @click="run">{{ flow.mode === 'enable' ? 'Включить защиту' : 'Разблокировать' }}</Button>
                <Button v-if="done && action?.kind === 'copy' && !copied" @click="copy">Копировать</Button>
                <Button variant="secondary" :disabled="busy && done" @click="leave">{{ done ? 'Вернуться' : 'Отмена' }}</Button>
            </div>
        </section>
    </main>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { createBiometricPrfProbe } from '../utils/biometricPrfProbe.js'
import Button from '../popup/components/ui/Button.vue'
import Message from '../popup/components/ui/Message.vue'

const busy = ref(false), step = ref(''), report = ref(null), copied = ref(false), error = ref('')
let controller, probe
const steps = { create: 'Создание тестового ключа', evalByCredential: 'PRF для конкретного ключа', eval: 'PRF с общей солью', discoverable: 'Поиск без фильтра по ID' }
const results = {
    created: 'Ключ создан. Теперь запустите проверку 2 отдельным нажатием.',
    'request-working': 'Запрос вернул PRF-секрет с подтверждением пользователя. Можно сравнить остальные способы или повторить этот запрос.',
    'discovery-working': 'Созданный ключ найден без фильтра по ID и вернул PRF-секрет. Сравните с проверками 2 и 3.',
    'both-working': 'Обе формы PRF работают и возвращают одинаковый секрет.',
    'eval-only': 'Работает только eval. Найдено различие между формами PRF-запроса.',
    'evalByCredential-only': 'Работает только evalByCredential. Найдено различие между формами PRF-запроса.',
    'no-prf': 'Этот запрос не вернул пригодный PRF-секрет с подтверждением пользователя. Подробности — в отчёте.',
    inconsistent: 'Провайдер вернул некорректный или неповторяемый результат. Такой ключ нельзя использовать для защиты.',
    aborted: 'Запрос отменён. Для новой попытки нажмите нужную кнопку.',
    'not-allowed': 'Браузер не завершил запрос: ключ не найден, запрос отклонён или истекло время ожидания. Это имя ошибки не позволяет различить причины. Следующий способ запускается только кнопкой.',
    'credential-mismatch': 'Провайдер вернул другой ключ. Сравнение остановлено.',
    'request-error': 'Не удалось завершить запрос. Этап и имя ошибки указаны в отчёте.'
}
const reportText = computed(() => report.value ? JSON.stringify(report.value, null, 2) : '')
const run = async mode => {
    if (busy.value) return
    busy.value = true; step.value = mode; copied.value = false; error.value = ''; controller = new AbortController()
    if (mode === 'create') { probe = createBiometricPrfProbe(); report.value = null }
    try { report.value = mode === 'create' ? await probe.create({ signal: controller.signal })
        : await probe.request(mode, { signal: controller.signal }) }
    catch { error.value = 'Не удалось выполнить диагностику.' }
    finally { busy.value = false }
}
const copy = async () => {
    try { await navigator.clipboard.writeText(reportText.value); copied.value = true }
    catch { error.value = 'Не удалось скопировать. Можно выделить отчёт ниже.' }
}
onBeforeUnmount(() => { controller?.abort(); probe = null })
</script>
<template>
    <main class="ui-background min-h-dvh p-4 text-ui-text sm:p-8">
        <section class="ui-panel mx-auto grid max-w-3xl gap-4 p-6" aria-labelledby="diagnostics-title">
            <p class="text-xs text-ui-muted">SUP 5th</p>
            <h1 id="diagnostics-title" class="text-xl font-semibold">Диагностика биометрии и PRF</h1>
            <p class="text-sm text-ui-muted">Создайте отдельный ключ «SUP 5th PRF test» у выбранного провайдера, затем запускайте проверки по одной. Каждая кнопка вызывает один системный запрос. Все проверки используют тот же ключ и ту же соль до закрытия или перезагрузки страницы.</p>
            <p class="text-sm text-ui-muted">Пароли и настройки расширения не меняются. Отчёт содержит версию браузера, признаки аутентификатора и результаты проверки, без паролей, секретов, идентификатора ключа и соли. Тестовый ключ останется у провайдера; его можно удалить после проверки.</p>
            <div class="flex flex-wrap gap-3">
                <Button :disabled="busy" @click="run('create')">{{ report?.registration ? 'Создать новый тестовый ключ' : '1. Создать тестовый ключ' }}</Button>
                <template v-if="report?.registration">
                    <Button :disabled="busy" variant="secondary" @click="run('evalByCredential')">2. Проверить по ID</Button>
                    <Button :disabled="busy" variant="secondary" @click="run('eval')">3. Проверить с общей PRF-солью</Button>
                    <Button :disabled="busy" variant="secondary" @click="run('discoverable')">4. Найти без фильтра по ID</Button>
                </template>
                <Button v-if="busy" variant="secondary" @click="controller?.abort()">Отмена</Button>
                <Button v-if="report" variant="secondary" @click="copy">{{ copied ? 'Скопировано' : 'Копировать отчёт' }}</Button>
            </div>
            <p v-if="busy" role="status" class="text-sm text-ui-accent">{{ steps[step] }}… Подтвердите запрос устройства.</p>
            <Message v-if="error" type="error">{{ error }}</Message>
            <p v-if="report" role="status" class="text-sm">{{ results[report.result] || report.result }}</p>
            <pre v-if="report" class="overflow-x-auto rounded-control border border-ui-border bg-ui-field p-4 text-xs" tabindex="0" aria-label="Отчёт диагностики">{{ reportText }}</pre>
        </section>
    </main>
</template>

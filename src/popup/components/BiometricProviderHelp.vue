<script setup>
import { biometricProviderHint, getBiometricPlatform } from '../../utils/biometricHello.js'
import { isFirefox, isSafari } from '../../platform/extensionApi.js'
const isMac = getBiometricPlatform() === 'mac'
const isWindows = getBiometricPlatform() === 'windows'
const isYandex = /YaBrowser\//i.test(navigator.userAgent)
</script>
<template>
    <p v-if="isWindows" class="text-xs text-ui-muted">{{ biometricProviderHint() }}</p>
    <details v-else-if="isMac" class="text-xs text-ui-muted">
        <summary class="cursor-pointer text-ui-accent">Как подключить Touch ID на Mac</summary>
        <div class="mt-3 grid gap-3">
            <p v-if="isSafari">{{ biometricProviderHint() }} Проверка открывается в отдельной вкладке. Защита включается только после успешной проверки повторной разблокировки.</p>
            <p v-else-if="isFirefox">На отдельной странице расширения выберите доступный в Firefox провайдер ключей доступа и подтвердите запрос устройства. Возможность использовать Touch ID зависит от выбранного провайдера.</p>
            <p v-else-if="isYandex">При создании ключа выберите «Ваш профиль Яндекс Браузер» и подтвердите запрос macOS. Вход в аккаунт и синхронизация для локального ключа не требуются.</p>
            <p v-else>Ключ можно сохранить в профиле браузера. Если доступна «Связка ключей iCloud» или Google Password Manager, можно выбрать их через «Другой способ».</p>
            <p>Если провайдер не выдаёт секрет шифрования, автоматически используется локальный режим совместимости. Он работает без сервера и дополнительных программ, но обеспечивает более слабую защиту. Удаление созданного ключа лишит доступа к зашифрованным паролям.</p>
            <p>При разблокировке выбирайте ключ SUP 5th с тем же коротким кодом, который указан в настройках защиты. Проверка может использовать Touch ID или пароль macOS.</p>
            <template v-if="!isYandex && !isFirefox && !isSafari">
                <p><strong class="text-ui-text">iCloud:</strong> откройте  → Системные настройки → ваше имя → iCloud → Пароли и включите синхронизацию этого Mac. При создании ключа выберите «Другой способ» → «Связка ключей iCloud».</p>
                <p><strong class="text-ui-text">Google:</strong> в Chrome войдите в аккаунт профиля и разрешите сохранение паролей и ключей доступа в аккаунте. При создании ключа выберите Google Password Manager.</p>
                <p>iCloud и Google могут синхронизировать выбранный passkey. Пароли SUP 5th остаются в расширении.</p>
            </template>
            <div v-if="!isYandex && !isFirefox && !isSafari" class="flex flex-wrap gap-3">
                <a href="https://support.apple.com/ru-ru/109016" target="_blank" rel="noreferrer" class="ui-link">Настройка iCloud</a>
                <a href="https://support.google.com/chrome/answer/13168025?hl=ru" target="_blank" rel="noreferrer" class="ui-link">Ключи доступа в Chrome</a>
            </div>
        </div>
    </details>
</template>

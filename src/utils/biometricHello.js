import { extensionApi, isFirefox, isSafari } from '../platform/extensionApi.js'
import { base64ToBytes, bytesToBase64, base64UrlToBytes, bytesToBase64Url, randomBytes, sealBytes, openBytes } from './credentialCrypto.js'
// WebAuthn: PRF и локальный режим совместимости для macOS без PRF.
// В режиме совместимости credential ID служит ключевым материалом и не сохраняется.
//
// Модуль работает ТОЛЬКО в страницах расширения (popup/options), где доступен
// navigator.credentials (в service worker WebAuthn недоступен).
//
// Некоторые провайдеры вычисляют PRF только при get(), а не при create().

const encoder = new TextEncoder()

const RP_NAME = 'SUP 5th'
const HKDF_SALT = encoder.encode('SUP5th-PRF-v1')
const HKDF_INFO = encoder.encode('SUP5th-hello-kek-v1')
const COMPAT_HKDF_INFO = encoder.encode('SUP5th-credential-id-kek-v1')

export const getBiometricPlatform = () => {
    const platform = navigator.userAgentData?.platform || navigator.platform || navigator.userAgent
    return /mac/i.test(platform) ? 'mac' : /win/i.test(platform) ? 'windows' : 'other'
}

export const biometricProviderHint = () => getBiometricPlatform() === 'windows'
    ? 'На Windows используется Windows Hello или другой провайдер passkey с PRF. После создания ключа нажмите «Проверить разблокировку» и подтвердите второй запрос. Защита включится после успешной проверки.'
    : isSafari
    ? 'Выберите ключ SUP 5th в системном окне Safari и подтвердите запрос устройства. Если Safari запрещает passkey на странице расширения, защита не включится.'
    : isFirefox
    ? 'Выберите доступный в Firefox провайдер passkey с поддержкой PRF. Проверка может использовать биометрию или системный PIN.'
    : getBiometricPlatform() === 'mac'
    ? 'На Mac при создании ключа нажмите «Другой способ» → «Связка ключей iCloud» или выберите Google Password Manager. Вариант «Ваш профиль Chrome» может не поддерживать PRF.'
    : 'Выберите настроенный на устройстве провайдер passkey с поддержкой PRF. Проверка может использовать биометрию или системный PIN.'

// Фактическую выдачу PRF проверяем на созданном ключе, а не по версии браузера.
export const getBiometricCapabilities = async () => ({
    available: typeof PublicKeyCredential !== 'undefined' &&
        typeof navigator.credentials?.create === 'function' && typeof navigator.credentials?.get === 'function'
})

const getRpId = () => (typeof extensionApi !== 'undefined' && extensionApi.runtime?.id) ? extensionApi.runtime.id : location.hostname

// Метки PRF неизменны для совместимости с существующими хранилищами Windows.
const deriveKek = async (secret, salt = HKDF_SALT, info = HKDF_INFO) => {
    const material = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveKey'])
    return crypto.subtle.deriveKey(
        { name: 'HKDF', hash: 'SHA-256', salt, info },
        material,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    )
}

const prfUnsupportedMessage = () => (
    'Выбранный passkey не выдал PRF-секрет. Успешная проверка устройства сама по себе не позволяет расшифровать пароли. ' +
    biometricProviderHint()
)

const readPrfSecret = (credential, { required = true } = {}) => {
    const prf = credential.getClientExtensionResults?.().prf
    const value = prf?.results?.first
    if (!value) {
        if (required) throw new Error(prfUnsupportedMessage())
        return null
    }
    const secret = new Uint8Array(value)
    if (secret.length !== 32) throw new Error('Провайдер passkey вернул PRF-секрет некорректной длины')
    return secret
}

// Windows сохраняет internal и evalByCredential из версии до адаптации под Mac.
// На остальных платформах учитываем транспорт выбранного провайдера.
const getBiometricSecret = async ({ credentialId, salt, transports = ['internal'], signal, allowMissingPrf = false }) => {
    signal?.throwIfAborted()
    const credentialTransports = getBiometricPlatform() === 'windows' ? ['internal'] : transports
    const options = {
        signal,
        publicKey: {
            ...(isFirefox || isSafari ? {} : { rpId: getRpId() }),
            challenge: randomBytes(32),
            timeout: 120000,
            userVerification: 'required',
            allowCredentials: [{
                id: base64UrlToBytes(credentialId),
                type: 'public-key',
                ...(credentialTransports.length ? { transports: credentialTransports } : {})
            }],
            extensions: {
                prf: {
                    evalByCredential: {
                        [credentialId]: { first: base64ToBytes(salt) }
                    }
                }
            }
        }
    }
    const credential = await navigator.credentials.get(options)
    signal?.throwIfAborted()
    if (!credential) throw new Error('Проверка устройства отменена')
    if (credential.id !== credentialId) throw new Error('Провайдер вернул другой passkey')
    return readPrfSecret(credential, { required: !allowMissingPrf })
}

const credentialIdBytes = credential => {
    const bytes = base64UrlToBytes(credential.id || '')
    if (bytes.length < 16 || bytes.length > 1023) throw new Error('Провайдер вернул некорректный идентификатор passkey')
    return bytes
}

const hashCredentialId = async bytes => bytesToBase64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))

// Discoverable get не требует сохранённого credential ID. Храним только его хеш.
const getCompatibilityKek = async ({ credentialIdHash, keySalt, passkeyName, signal }) => {
    signal?.throwIfAborted()
    const credential = await navigator.credentials.get({
        signal,
        publicKey: {
            ...(isFirefox || isSafari ? {} : { rpId: getRpId() }), challenge: randomBytes(32), timeout: 120000,
            userVerification: 'required', allowCredentials: []
        }
    })
    signal?.throwIfAborted()
    if (!credential) throw new Error('Проверка устройства отменена')
    const bytes = credentialIdBytes(credential)
    if (await hashCredentialId(bytes) !== credentialIdHash) {
        throw new Error(`Выбран другой passkey. Выберите ${passkeyName || 'ключ, созданный при включении защиты SUP 5th'}.`)
    }
    const authenticatorData = new Uint8Array(credential.response.authenticatorData)
    if (authenticatorData.length < 37 || (authenticatorData[32] & 5) !== 5) {
        throw new Error('Провайдер passkey не подтвердил проверку пользователя')
    }
    return deriveKek(bytes, base64ToBytes(keySalt), COMPAT_HKDF_INFO)
}

// До шифрования данных проверяем тот же get(), которым будет открываться хранилище.
// PRF в create() сам по себе не доказывает работоспособность будущего unlock.
const confirmPrfUnlock = async ({ credential, salt, transports, isMac, signal, beforeUnlockCheck }) => {
    const createPrf = credential.getClientExtensionResults?.().prf
    const createSecret = readPrfSecret(credential, { required: false })
    if (isMac && createPrf?.enabled === false && !createSecret) return null
    // Страница может дождаться отдельного нажатия после закрытия окна создания.
    // Не включаем защиту, пока тот же ключ не прошёл get().
    await beforeUnlockCheck?.()
    signal?.throwIfAborted()
    let secret
    try {
        secret = await getBiometricSecret({ credentialId: credential.id, salt, transports, signal,
            allowMissingPrf: isMac && !createSecret })
    } catch (error) {
        if (['AbortError', 'NotAllowedError'].includes(error.name)) throw error
        throw new Error(`Проверка разблокировки не пройдена. Защита не включена. ${error.message}`, { cause: error })
    }
    if (createSecret && !createSecret.every((value, index) => value === secret[index])) {
        throw new Error('Провайдер вернул разные PRF-секреты при создании и разблокировке. Защита не включена.')
    }
    return secret
}

// Регистрация passkey с подтверждением будущей разблокировки.
const registerBiometricPasskey = async ({ signal, beforeUnlockCheck } = {}) => {
    signal?.throwIfAborted()
    const platform = getBiometricPlatform()
    const isMac = platform === 'mac'
    // Суффикс помогает отличить рабочий ключ от старых ключей в меню браузера.
    const passkeyName = isMac ? `SUP 5th · ${bytesToBase64Url(randomBytes(3))}` : 'SUP 5th'
    const salt = randomBytes(32)
    const saltB64 = bytesToBase64(salt)
    const options = {
        signal,
        publicKey: {
            rp: { ...(isFirefox || isSafari ? {} : { id: getRpId() }), name: RP_NAME },
            user: {
                id: randomBytes(16),
                name: passkeyName,
                displayName: passkeyName
            },
            challenge: randomBytes(32),
            pubKeyCredParams: [
                { type: 'public-key', alg: -7 },
                { type: 'public-key', alg: -257 }
            ],
            authenticatorSelection: {
                // На Mac не принуждаем старый локальный Touch ID-аутентификатор.
                ...(isMac ? { requireResidentKey: true } : { authenticatorAttachment: 'platform' }),
                residentKey: 'required',
                userVerification: 'required'
            },
            attestation: 'none',
            timeout: 120000,
            extensions: {
                prf: { eval: { first: salt } },
                ...(isMac ? { credProps: true } : {})
            }
        }
    }
    const credential = await navigator.credentials.create(options)
    signal?.throwIfAborted()
    if (!credential) throw new Error('Создание пасскея отменено')

    const reportedTransports = credential.response?.getTransports?.() || []
    const transports = platform === 'windows' ? ['internal']
        : reportedTransports.length ? reportedTransports : (isMac ? [] : ['internal'])
    const prfSecret = await confirmPrfUnlock({ credential, salt: saltB64, transports, isMac, signal, beforeUnlockCheck })
    if (!prfSecret) {
        if (credential.getClientExtensionResults?.().credProps?.rk === false) {
            throw new Error('Для локальной разблокировки нужен сохраняемый в браузере passkey')
        }
        const bytes = credentialIdBytes(credential)
        return { keySource: 'credential-id', credentialIdHash: await hashCredentialId(bytes),
            keySalt: saltB64, passkeyName, kek: await deriveKek(bytes, salt, COMPAT_HKDF_INFO) }
    }
    return {
        credentialId: credential.id,
        transports,
        salt: saltB64,
        prfSecret
    }
}

// Включение биометрии (вызывается из страницы): создаёт passkey, оборачивает
// новый vault-ключ PRF-секретом и возвращает данные для background (security:enableHello).
export const enableBiometricProtectionFlow = async (options = {}) => {
    const rawVaultKey = randomBytes(32)
    const registration = await registerBiometricPasskey(options)
    if (registration.keySource === 'credential-id') {
        const { kek, ...config } = registration
        const wrappedKey = await sealBytes(rawVaultKey, kek)
        options.signal?.throwIfAborted()
        return { rawVaultKey: bytesToBase64(rawVaultKey), ...config, wrappedKey }
    }
    const { credentialId, transports, salt, prfSecret } = registration
    const kek = await deriveKek(prfSecret)
    const wrappedKey = await sealBytes(rawVaultKey, kek)
    options.signal?.throwIfAborted()
    return {
        rawVaultKey: bytesToBase64(rawVaultKey),
        credentialId,
        transports,
        prfSalt: salt,
        wrappedKey
    }
}

// Проверка устройства -> PRF-секрет -> разворачиваем vault-ключ.
// Возвращает { key } (base64) для background (security:unlockHelloKey).
export const unlockWithBiometricFlow = async ({ credentialId, prfSalt, wrappedKey, transports, keySource = 'prf', credentialIdHash, keySalt, passkeyName, signal }) => {
    signal?.throwIfAborted()
    const compatible = keySource === 'credential-id'
    if (!['prf', 'credential-id'].includes(keySource) || !wrappedKey?.iv || !wrappedKey?.ciphertext ||
        (compatible ? (!/^[A-Za-z0-9_-]{43}$/.test(credentialIdHash || '') || base64ToBytes(keySalt || '').length !== 32) : (!credentialId || !prfSalt))) {
        throw new Error('Параметры биометрии повреждены. Перевключите защиту.')
    }
    // Источник ключа фиксируется при настройке; существующий PRF-ключ не понижаем.
    const kek = compatible
        ? await getCompatibilityKek({ credentialIdHash, keySalt, passkeyName, signal })
        : await deriveKek(await getBiometricSecret({ credentialId, salt: prfSalt, transports, signal }))
    const rawKey = await openBytes(wrappedKey, kek)
    signal?.throwIfAborted()
    if (rawKey.length !== 32) throw new Error('Провайдер passkey вернул некорректный ключ')
    return { key: bytesToBase64(rawKey) }
}

import { extensionApi, isFirefox } from '../platform/extensionApi.js'
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

export const randomBytes = (length) => crypto.getRandomValues(new Uint8Array(length))

export const getBiometricPlatform = () => {
    const platform = navigator.userAgentData?.platform || navigator.platform || navigator.userAgent
    return /mac/i.test(platform) ? 'mac' : /win/i.test(platform) ? 'windows' : 'other'
}

export const biometricProviderHint = () => isFirefox
    ? 'Выберите доступный в Firefox провайдер passkey с поддержкой PRF. Проверка может использовать биометрию или системный PIN.'
    : getBiometricPlatform() === 'mac'
    ? 'На Mac при создании ключа нажмите «Другой способ» → «Связка ключей iCloud» или выберите Google Password Manager. Вариант «Ваш профиль Chrome» может не поддерживать PRF.'
    : 'Выберите настроенный на устройстве провайдер passkey с поддержкой PRF. Проверка может использовать биометрию или системный PIN.'

// --- base64 / base64url ---
const bytesToBase64 = (bytes) => {
    let binary = ''
    const chunkSize = 0x8000
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
    }
    return btoa(binary)
}

const base64ToBytes = (value) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0))

export const bytesToBase64Url = (bytes) =>
    bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')

export const base64UrlToBytes = (value) => {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
    return base64ToBytes(padded)
}

// --- Доступность биометрии и PRF ---
export const isBiometricAvailable = async () => {
    if (typeof PublicKeyCredential === 'undefined' ||
        typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') {
        return false
    }
    try {
        return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
    } catch {
        return false
    }
}

// Возможности браузера не гарантируют PRF у выбранного провайдера passkey.
const getClientCapabilities = async () => {
    if (typeof globalThis.PublicKeyCredential?.getClientCapabilities === 'function') {
        try {
            return await PublicKeyCredential.getClientCapabilities()
        } catch {
            return null
        }
    }
    return null
}

export const getBiometricCapabilities = async () => {
    const caps = await getClientCapabilities()
    const match = navigator.userAgent.match(/\bChrome\/(\d+)/)
    const chromeMajor = match ? Number(match[1]) : 0
    return {
        helloAvailable: await isBiometricAvailable(),
        available: typeof PublicKeyCredential !== 'undefined' &&
            typeof navigator.credentials?.create === 'function' && typeof navigator.credentials?.get === 'function',
        unavailableReason: '',
        platform: getBiometricPlatform(),
        // В Chrome возможности расширений WebAuthn именуются как "extension:prf"
        prf: typeof caps?.['extension:prf'] === 'boolean' ? caps['extension:prf'] : null,
        capabilities: caps || null,
        chromeMajor
    }
}

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

export const wrapKey = async (rawKey, kek) => {
    const iv = randomBytes(12)
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, kek, rawKey))
    return { iv: bytesToBase64(iv), ciphertext: bytesToBase64(ciphertext) }
}

export const unwrapKey = async (wrapped, kek) => {
    const plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: base64ToBytes(wrapped.iv) },
        kek,
        base64ToBytes(wrapped.ciphertext)
    )
    return new Uint8Array(plaintext)
}

const prfUnsupportedMessage = () => (
    'Выбранный passkey не выдал PRF-секрет. Успешная проверка устройства сама по себе не позволяет расшифровать пароли. ' +
    biometricProviderHint()
)

const readPrfSecret = (credential, { required = true } = {}) => {
    const value = credential.getClientExtensionResults?.().prf?.results?.first
    if (!value) {
        if (required) throw new Error(prfUnsupportedMessage())
        return null
    }
    const secret = new Uint8Array(value)
    if (secret.length !== 32) throw new Error('Провайдер passkey вернул PRF-секрет некорректной длины')
    return secret
}

// Старые Windows-записи сохраняют internal и evalByCredential.
// У новых записей используем транспорт, сообщённый самим провайдером.
const getBiometricSecret = async ({ credentialId, salt, transports = ['internal'], signal, allowMissingPrf = false }) => {
    signal?.throwIfAborted()
    const options = {
        signal,
        publicKey: {
            ...(isFirefox ? {} : { rpId: getRpId() }),
            challenge: randomBytes(32),
            timeout: 120000,
            userVerification: 'required',
            allowCredentials: [{
                id: base64UrlToBytes(credentialId),
                type: 'public-key',
                ...(transports.length ? { transports } : {})
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
            ...(isFirefox ? {} : { rpId: getRpId() }), challenge: randomBytes(32), timeout: 120000,
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

// Регистрация passkey. Часть аутентификаторов возвращает PRF-результат прямо в create,
// остальные — только при повторном get с prf.evalByCredential.
const registerBiometricPasskey = async ({ signal } = {}) => {
    signal?.throwIfAborted()
    const isMac = getBiometricPlatform() === 'mac'
    // Суффикс помогает отличить рабочий ключ от старых ключей в меню браузера.
    const passkeyName = isMac ? `SUP 5th · ${bytesToBase64Url(randomBytes(3))}` : 'SUP 5th'
    const salt = randomBytes(32)
    const saltB64 = bytesToBase64(salt)
    const options = {
        signal,
        publicKey: {
            rp: { ...(isFirefox ? {} : { id: getRpId() }), name: RP_NAME },
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
    const transports = reportedTransports.length ? reportedTransports : (getBiometricPlatform() === 'mac' ? [] : ['internal'])
    const createPrf = credential.getClientExtensionResults?.().prf
    let prfSecret = null
    if (createPrf?.results?.first) {
        prfSecret = readPrfSecret(credential)
    } else {
        // Явное отсутствие PRF на Mac не требует второго подтверждения.
        // При неизвестной поддержке сначала пробуем get. Ошибки/отмена не вызывают fallback.
        if (!isMac || createPrf?.enabled !== false) {
            prfSecret = await getBiometricSecret({ credentialId: credential.id, salt: saltB64, transports, signal, allowMissingPrf: isMac })
        }
    }
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
        const wrappedKey = await wrapKey(rawVaultKey, kek)
        options.signal?.throwIfAborted()
        return { rawVaultKey: bytesToBase64(rawVaultKey), ...config, wrappedKey }
    }
    const { credentialId, transports, salt, prfSecret } = registration
    const kek = await deriveKek(prfSecret)
    const wrappedKey = await wrapKey(rawVaultKey, kek)
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
    const rawKey = await unwrapKey(wrappedKey, kek)
    signal?.throwIfAborted()
    if (rawKey.length !== 32) throw new Error('Провайдер passkey вернул некорректный ключ')
    return { key: bytesToBase64(rawKey) }
}

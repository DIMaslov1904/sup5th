// Биометрия (Windows Hello) через WebAuthn + расширение PRF.
// Перенос подхода RoboForm-Chrome: платформенный passkey, userVerification "required",
// детерминированный PRF-секрет -> ключ обёртки vault-ключа. Без нативных хостов.
//
// Модуль работает ТОЛЬКО в страницах расширения (popup/options), где доступен
// navigator.credentials (в service worker WebAuthn недоступен).

const encoder = new TextEncoder()

const RP_NAME = 'SUP 5th'
const HKDF_SALT = encoder.encode('SUP5th-PRF-v1')
const HKDF_INFO = encoder.encode('SUP5th-hello-kek-v1')

export const randomBytes = (length) => crypto.getRandomValues(new Uint8Array(length))

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

// PRF для платформенных аутентификаторов появился в Chrome 130 (Windows/macOS)
export const isPrfLikelySupported = () => {
    const match = navigator.userAgent.match(/\bChrome\/(\d+)/)
    return Boolean(match && Number(match[1]) >= 130)
}

const getRpId = () => (typeof chrome !== 'undefined' && chrome.runtime?.id) ? chrome.runtime.id : location.hostname

// --- Вывод ключа обёртки из PRF-секрета (как у RoboForm: HMAC/HKDF по метке) ---
const deriveKek = async (prfSecret) => {
    const material = await crypto.subtle.importKey('raw', prfSecret, 'HKDF', false, ['deriveKey'])
    return crypto.subtle.deriveKey(
        { name: 'HKDF', hash: 'SHA-256', salt: HKDF_SALT, info: HKDF_INFO },
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

// Получение детерминированного PRF-секрета после проверки Windows Hello
const getBiometricSecret = async ({ credentialId, salt }) => {
    const options = {
        publicKey: {
            rpId: getRpId(),
            challenge: randomBytes(32),
            timeout: 120000,
            userVerification: 'required',
            allowCredentials: [{
                id: base64UrlToBytes(credentialId),
                type: 'public-key',
                transports: ['internal']
            }],
            extensions: { prf: { eval: { first: base64UrlToBytes(salt) } } }
        }
    }
    const credential = await navigator.credentials.get(options)
    if (!credential) throw new Error('Проверка Windows Hello отменена')
    const results = credential.getClientExtensionResults?.().prf
    if (!results?.results?.first) throw new Error('Windows Hello не вернул секрет (PRF недоступен)')
    return new Uint8Array(results.results.first)
}

// Регистрация passkey: create (prf enabled) + get (prf eval) -> PRF-секрет.
// Двухшаговый процесс надёжнее: создание с eval поддерживается не во всех браузерах.
const registerBiometricPasskey = async () => {
    const salt = randomBytes(32)
    const options = {
        publicKey: {
            rp: { id: getRpId(), name: RP_NAME },
            user: {
                id: randomBytes(16),
                name: 'SUP 5th',
                displayName: 'SUP 5th'
            },
            challenge: randomBytes(32),
            pubKeyCredParams: [
                { type: 'public-key', alg: -7 },
                { type: 'public-key', alg: -257 }
            ],
            authenticatorSelection: {
                authenticatorAttachment: 'platform',
                residentKey: 'required',
                userVerification: 'required'
            },
            attestation: 'none',
            timeout: 120000,
            extensions: { prf: { enable: true } }
        }
    }
    const credential = await navigator.credentials.create(options)
    if (!credential) throw new Error('Создание пасскея отменено')
    const enabled = credential.getClientExtensionResults?.().prf?.enabled
    if (!enabled) throw new Error('Windows Hello/PRF не поддерживается этим браузером (нужен Chrome 130+ на Windows)')

    const prfSecret = await getBiometricSecret({
        credentialId: credential.id,
        salt: bytesToBase64Url(salt)
    })
    return {
        credentialId: credential.id,
        salt: bytesToBase64Url(salt),
        prfSecret
    }
}

// Включение биометрии (вызывается из страницы): создаёт passkey, оборачивает
// новый vault-ключ PRF-секретом и возвращает данные для background (security:enableHello).
export const enableBiometricProtectionFlow = async () => {
    const rawVaultKey = randomBytes(32)
    const { credentialId, salt, prfSecret } = await registerBiometricPasskey()
    const kek = await deriveKek(prfSecret)
    const wrappedKey = await wrapKey(rawVaultKey, kek)
    return {
        rawVaultKey: bytesToBase64(rawVaultKey),
        credentialId,
        prfSalt: salt,
        wrappedKey
    }
}

// Разблокировка биометрией: Windows Hello -> PRF-секрет -> разворачиваем vault-ключ.
// Возвращает { key } (base64) для background (security:unlockHelloKey).
export const unlockWithBiometricFlow = async ({ credentialId, prfSalt, wrappedKey }) => {
    if (!credentialId || !prfSalt || !wrappedKey?.iv || !wrappedKey?.ciphertext) {
        throw new Error('Параметры Windows Hello повреждены. Перевключите защиту.')
    }
    const prfSecret = await getBiometricSecret({ credentialId, salt: prfSalt })
    const kek = await deriveKek(prfSecret)
    const rawKey = await unwrapKey(wrappedKey, kek)
    if (rawKey.length !== 32) throw new Error('Windows Hello вернул некорректный ключ')
    return { key: bytesToBase64(rawKey) }
}

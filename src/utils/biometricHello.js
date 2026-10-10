// Биометрия (Windows Hello) через WebAuthn + расширение PRF.
// Перенос подхода RoboForm-Chrome: платформенный passkey, userVerification "required",
// детерминированный PRF-секрет -> ключ обёртки vault-ключа. Без нативных хостов.
//
// Модуль работает ТОЛЬКО в страницах расширения (popup/options), где доступен
// navigator.credentials (в service worker WebAuthn недоступен).
//
// Важно: часть аутентификаторов/браузеров не возвращает PRF-результат в момент
// create (prf.enabled может быть false), но отдаёт его при повторном get с
// prf.evalByCredential. Поэтому регистрация двухшаговая: create -> get.

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

// Возможности браузера (Chrome 131+): { prf: bool, userVerifyingPlatformAuthenticator: bool, ... }
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
        // В Chrome возможности расширений WebAuthn именуются как "extension:prf"
        prf: Boolean(caps && typeof caps['extension:prf'] === 'boolean' ? caps['extension:prf'] : chromeMajor >= 130),
        capabilities: caps || null,
        chromeMajor
    }
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

const prfUnsupportedMessage = () => (
    'Windows Hello/PRF не поддерживается: браузер не выдал PRF-секрет для passkey. ' +
    'Проверьте, что passkey создаётся как device-bound (Windows Hello), а не в Google Password Manager ' +
    '(chrome://settings/passkeys → переключатель «Создавать passkey в Windows Hello»), ' +
    'и удалите лишние passkey для этого расширения.'
)

// Получение детерминированного PRF-секрета после проверки Windows Hello.
// Используем evalByCredential — каноничная форма get для одного известного credential.
const getBiometricSecret = async ({ credentialId, salt, signal }) => {
    const options = {
        signal,
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
    if (!credential) throw new Error('Проверка Windows Hello отменена')
    const results = credential.getClientExtensionResults?.().prf?.results
    if (!results?.first) throw new Error(prfUnsupportedMessage())
    return new Uint8Array(results.first)
}

// Регистрация passkey. Часть аутентификаторов возвращает PRF-результат прямо в create,
// остальные — только при повторном get с prf.evalByCredential.
const registerBiometricPasskey = async () => {
    const salt = randomBytes(32)
    const saltB64 = bytesToBase64(salt)
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
            extensions: {
                prf: { enable: true, eval: { first: salt } }
            }
        }
    }
    const credential = await navigator.credentials.create(options)
    if (!credential) throw new Error('Создание пасскея отменено')

    const createPrf = credential.getClientExtensionResults?.().prf
    let prfSecret = null
    if (createPrf?.results?.first) {
        prfSecret = new Uint8Array(createPrf.results.first)
    } else {
        // Второй шаг: некоторые аутентификаторы не вычисляют PRF в момент create,
        // но отдают секрет при get (это нормальное поведение, см. WebAuthn PRF).
        prfSecret = await getBiometricSecret({ credentialId: credential.id, salt: saltB64 })
    }
    return {
        credentialId: credential.id,
        salt: saltB64,
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
export const unlockWithBiometricFlow = async ({ credentialId, prfSalt, wrappedKey, signal }) => {
    signal?.throwIfAborted()
    if (!credentialId || !prfSalt || !wrappedKey?.iv || !wrappedKey?.ciphertext) {
        throw new Error('Параметры Windows Hello повреждены. Перевключите защиту.')
    }
    const prfSecret = await getBiometricSecret({ credentialId, salt: prfSalt, signal })
    const kek = await deriveKek(prfSecret)
    const rawKey = await unwrapKey(wrappedKey, kek)
    signal?.throwIfAborted()
    if (rawKey.length !== 32) throw new Error('Windows Hello вернул некорректный ключ')
    return { key: bytesToBase64(rawKey) }
}

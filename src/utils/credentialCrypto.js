const encoder = new TextEncoder()
const decoder = new TextDecoder()

export const bytesToBase64 = (bytes) => {
    let binary = ''
    const chunkSize = 0x8000
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
    }
    return btoa(binary)
}

export const base64ToBytes = (value) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0))

export const bytesToBase64Url = bytes => bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')

export const base64UrlToBytes = value => {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
    return base64ToBytes(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '='))
}

export const randomBytes = (length) => crypto.getRandomValues(new Uint8Array(length))

export const importAesKey = (rawKey, usages = ['encrypt', 'decrypt']) =>
    crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, usages)

export const sealBytes = async (plaintext, key) => {
    const iv = randomBytes(12)
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)
    return { iv: bytesToBase64(iv), ciphertext: bytesToBase64(new Uint8Array(ciphertext)) }
}

export const openBytes = async (sealed, key) => {
    const plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: base64ToBytes(sealed.iv) },
        key,
        base64ToBytes(sealed.ciphertext)
    )
    return new Uint8Array(plaintext)
}

export const sealJson = (value, key) => sealBytes(encoder.encode(JSON.stringify(value)), key)

export const openJson = async (sealed, key) => JSON.parse(decoder.decode(await openBytes(sealed, key)))

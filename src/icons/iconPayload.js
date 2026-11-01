import { findIconCandidates, normalizeIcon } from './iconDom.js'

export const blobDataUrl = async blob => {
    const bytes = new Uint8Array(await blob.arrayBuffer())
    let binary = ''
    for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192))
    return `data:${blob.type || 'application/octet-stream'};base64,${btoa(binary)}`
}

// Shared payload contract for the offscreen document and the Firefox page.
export const decodeIconPayload = async payload => {
    if (payload?.type === 'candidates') return findIconCandidates(payload.html, payload.url)
    if (payload?.type !== 'normalize') throw new Error('Неизвестная операция иконки')
    const response = await fetch(payload.dataUrl)
    return blobDataUrl(await normalizeIcon(await response.blob()))
}

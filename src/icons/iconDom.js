import { ICON_SVG_LIMIT } from './iconPolicy.js'

export const findIconCandidates = (html, pageUrl) => {
    const document = new DOMParser().parseFromString(html, 'text/html')
    let base = pageUrl
    try { base = new URL(document.querySelector('base[href]')?.getAttribute('href') || pageUrl, pageUrl).href } catch { /* use response URL */ }
    const links = [...document.querySelectorAll('link[href]')].filter(link => {
        const rel = (link.getAttribute('rel') || '').toLowerCase().split(/\s+/)
        return rel.includes('icon') || rel.includes('apple-touch-icon')
    }).map(link => {
        try {
            const url = new URL(link.getAttribute('href'), base)
            if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null
            const rel = (link.getAttribute('rel') || '').toLowerCase().split(/\s+/)
            return { url: url.href, score: (rel.includes('icon') ? 100 : 0) + (link.getAttribute('type') === 'image/svg+xml' ? 20 : 0) }
        } catch { return null }
    }).filter(Boolean).sort((a, b) => b.score - a.score)
    return [...new Set([...links.map(link => link.url), new URL('/favicon.ico', pageUrl).href])].slice(0, 4)
}

export const normalizeIcon = async blob => {
    const text = await blob.slice(0, 1024).text()
    const svg = blob.type.includes('svg') || /^\s*(?:<\?xml[^>]*>\s*)?(?:<!--[^]*?-->\s*)*<svg[\s>]/i.test(text)
    if (svg) {
        if (blob.size > ICON_SVG_LIMIT) throw new Error('SVG превышает 128 КБ')
        const parsed = new DOMParser().parseFromString(await blob.text(), 'image/svg+xml')
        if (parsed.querySelector('parsererror') || parsed.documentElement.localName !== 'svg') throw new Error('Некорректный SVG')
        // Use only as an image resource, never insert third-party markup into the UI.
        return new Blob([blob], { type: 'image/svg+xml' })
    }
    const url = URL.createObjectURL(blob)
    try {
        const image = new Image()
        let timer
        await new Promise((resolve, reject) => {
            image.onload = resolve
            image.onerror = () => reject(new Error('Не удалось декодировать иконку'))
            timer = setTimeout(() => reject(new Error('Не удалось декодировать иконку')), 5000)
            image.src = url
        }).finally(() => clearTimeout(timer))
        if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth > 8192 || image.naturalHeight > 8192) throw new Error('Некорректный размер иконки')
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = 64
        const scale = Math.min(64 / image.naturalWidth, 64 / image.naturalHeight)
        const width = image.naturalWidth * scale, height = image.naturalHeight * scale
        canvas.getContext('2d').drawImage(image, (64 - width) / 2, (64 - height) / 2, width, height)
        const result = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
        if (!result) throw new Error('Не удалось уменьшить иконку')
        return result
    } finally { URL.revokeObjectURL(url) }
}

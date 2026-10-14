import { displayUrl } from './displayUrl.js'

const webUrl = (value, base) => {
    if (!value) return ''
    try {
        const url = new URL(value, base)
        return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''
    } catch { return '' }
}

export const buildOpenGraphPreview = report => {
    const tags = (report?.metaTags || []).filter(tag => tag.inHead !== false)
    const first = name => tags.find(tag => tag.name.toLowerCase() === name)?.content?.trim() || ''
    // Структурные свойства принадлежат первому og:image, а не следующему изображению.
    const imageTags = []
    for (const tag of tags) {
        const name = tag.name.toLowerCase()
        if (['og:image', 'og:image:url'].includes(name) && imageTags.length) break
        if (['og:image', 'og:image:url'].includes(name) || (imageTags.length && name.startsWith('og:image:'))) imageTags.push(tag)
    }
    const imageValue = name => imageTags.find(tag => tag.name.toLowerCase() === name)?.content?.trim() || ''
    const base = report?.baseUrl || report?.url
    const url = webUrl(first('og:url'), base) || webUrl(report?.url, base)
    let domain = ''
    try { domain = displayUrl(new URL(url).hostname) } catch {}
    return {
        title: first('og:title') || report?.title || 'Без заголовка',
        description: first('og:description') || report?.description || '',
        image: webUrl(imageValue('og:image:secure_url'), base) || webUrl(imageValue('og:image') || imageValue('og:image:url'), base),
        imageAlt: imageValue('og:image:alt') || 'Изображение Open Graph',
        siteName: first('og:site_name') || domain, domain,
        hasOg: tags.some(tag => /^og:/i.test(tag.name))
    }
}

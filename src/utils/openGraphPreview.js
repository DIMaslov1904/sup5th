import { displayUrl } from './displayUrl.js'

const webUrl = (value, base) => {
    if (!value) return ''
    try {
        const url = new URL(value, base)
        return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''
    } catch { return '' }
}

const readTag = (tags, name) => tags.find(tag => tag.name.toLowerCase() === name)?.content?.trim() || ''

export const buildOpenGraphPreview = report => {
    const tags = (report?.metaTags || []).filter(tag => tag.inHead !== false)
    const first = name => readTag(tags, name)
    // Структурные свойства принадлежат первому og:image, а не следующему изображению.
    const imageTags = []
    for (const tag of tags) {
        const name = tag.name.toLowerCase()
        if (['og:image', 'og:image:url'].includes(name) && imageTags.length) break
        if (['og:image', 'og:image:url'].includes(name) || (imageTags.length && name.startsWith('og:image:'))) imageTags.push(tag)
    }
    const imageValue = name => readTag(imageTags, name)
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

export const buildTwitterPreview = (report, openGraph) => {
    const tags = (report?.metaTags || []).filter(tag => tag.inHead !== false)
    const first = name => readTag(tags, name)
    const declaredType = first('twitter:card').toLowerCase()
    const hasSummaryFallback = ['og:type', 'og:title', 'og:description'].every(name => first(name))
    const type = declaredType || (hasSummaryFallback ? 'summary' : '')
    const layout = type === 'summary_large_image' ? 'x-wide' : type === 'summary' ? 'x-small' : ''
    const title = first('twitter:title') || first('og:title')
    const image = webUrl(first('twitter:image'), report?.baseUrl || report?.url)
    const note = !type ? 'Карточка может не появиться. Укажите twitter:card или дополните Open Graph.'
        : !layout ? 'Тип «' + type + '» не входит в этот предпросмотр.'
        : !title ? 'Для карточки нужен twitter:title или og:title.'
        : !declaredType ? 'Возможная карточка summary на основе Open Graph.' : ''
    return {
        layout: title ? layout : '', note, type,
        title, description: first('twitter:description') || first('og:description'),
        image: image || openGraph.image,
        imageAlt: first('twitter:image:alt') || (image ? 'Изображение карточки X' : openGraph.imageAlt),
        domain: openGraph.domain
    }
}

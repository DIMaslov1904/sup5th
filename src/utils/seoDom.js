export const textStatistics = (text) => {
    const words = String(text || '').toLowerCase().match(/[\p{L}\p{N}]+/gu) || []
    const top = values => {
        const counts = new Map()
        for (const value of values) counts.set(value, (counts.get(value) || 0) + 1)
        return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([word, count]) => ({ word, count, density: values.length ? +(count / values.length * 100).toFixed(2) : 0 }))
    }
    return { words: words.length, characters: text.length, withoutSpaces: text.replace(/\s/g, '').length, top: top(words), bigrams: top(words.slice(1).map((word, i) => `${words[i]} ${word}`)) }
}
const textWithoutAnchors = doc => {
    if (!doc.body) return ''
    const filter = doc.defaultView?.NodeFilter || globalThis.NodeFilter
    const walker = doc.createTreeWalker(doc.body, filter.SHOW_TEXT, node => node.parentElement?.closest('a,script,style,template,noscript') ? filter.FILTER_REJECT : filter.FILTER_ACCEPT)
    const parts = []
    while (walker.nextNode()) parts.push(walker.currentNode.data)
    return parts.join('')
}
export const collectMetaTags = root => [...(root?.querySelectorAll('meta') || [])].map(el => ({
    attribute: el.hasAttribute('name') ? 'name' : el.hasAttribute('property') ? 'property' : el.hasAttribute('http-equiv') ? 'http-equiv' : 'charset',
    name: el.getAttribute('name') || el.getAttribute('property') || el.getAttribute('http-equiv') || (el.hasAttribute('charset') ? 'charset' : '(без названия)'),
    content: el.content || el.getAttribute('charset') || '', inHead: Boolean(el.closest('head'))
}))
export const seoImageSource = element => element.currentSrc || element.dataset.src || element.src

export const collectSeoDom = (doc, pageUrl, images = Array.from(doc.images, (element, id) => [id, element])) => {
    const host = new URL(pageUrl).hostname
    const metaTags = collectMetaTags(doc).filter(el => !/^twitter:/i.test(el.name))
    const linkRows = [...doc.querySelectorAll('a[href]:not([data-sup-seo-download])')].map((el, id) => {
        let url; try { url = new URL(el.getAttribute('href'), doc.baseURI || pageUrl) } catch {}
        const labelledBy = (el.getAttribute('aria-labelledby') || '').split(/\s+/).map(id => doc.getElementById(id)?.textContent || '').join(' ').trim()
        const accessibleName = labelledBy || el.getAttribute('aria-label')?.trim() || el.textContent.trim() || [...el.querySelectorAll('img[alt]')].map(image => image.alt.trim()).filter(Boolean).join(' ')
        return { id, url: url?.href || el.getAttribute('href'), text: el.textContent.trim() || el.querySelector('img')?.alt || '', accessibleName, rel: el.rel || '', external: Boolean(url?.hostname && url.hostname !== host), protocol: url?.protocol || '', nofollow: /\b(nofollow|ugc|sponsored)\b/i.test(el.rel) }
    })
    const imageRows = images.map(([id, el]) => ({ id, src: seoImageSource(el), alt: el.getAttribute('alt'), title: el.title, width: el.naturalWidth || el.width, height: el.naturalHeight || el.height, loading: el.loading }))
    const jsonLd = [...doc.querySelectorAll('script[type="application/ld+json"]')].map(el => {
        try { return { valid: true, value: JSON.parse(el.textContent) } }
        catch (e) { return { valid: false, error: e.message, raw: el.textContent.slice(0, 10000) } }
    })
    const body = doc.body?.innerText || doc.body?.textContent || ''
    const anchors = [...doc.querySelectorAll('a:not([data-sup-seo-download])')].map(el => el.innerText || el.textContent).join(' ')
    return {
        metaTags, titles: [...doc.querySelectorAll('title')].map(el => ({ text: el.textContent.trim(), inHead: Boolean(el.closest('head')) })),
        canonicals: [...doc.querySelectorAll('link[rel~="canonical" i]')].map(el => ({ href: el.href, raw: el.getAttribute('href'), inHead: Boolean(el.closest('head')) })),
        headingRows: [...doc.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((el, id) => ({ id, level: Number(el.tagName[1]), text: el.textContent.trim() })),
        linkRows, imageRows, jsonLd,
        microdata: [...doc.querySelectorAll('[itemscope]')].map(el => ({ type: el.getAttribute('itemtype') || '', properties: [...el.querySelectorAll('[itemprop]')].map(p => ({ name: p.getAttribute('itemprop'), value: p.getAttribute('content') || p.getAttribute('href') || p.textContent.trim() })) })),
        rdfa: [...doc.querySelectorAll('[typeof]')].map(el => ({ type: el.getAttribute('typeof'), text: el.textContent.trim().slice(0, 500) })),
        statistics: { ...textStatistics(body), withoutAnchors: textStatistics(textWithoutAnchors(doc)), anchors: textStatistics(anchors), imageText: textStatistics(imageRows.map(el => `${el.alt || ''} ${el.title || ''}`).join(' ')), selection: textStatistics(doc.getSelection?.()?.toString() || '') }
    }
}

const state = { headings: false, external: false, noindex: false, alt: false, downloads: false, css: false }
const sheets = new Map()
let style, overlays, observer, scheduled = false
const classes = ['sup-seo-heading', 'sup-seo-external', 'sup-seo-noindex']
const rects = (range, color) => {
    for (const rect of [...range.getClientRects()].slice(0, 1000)) {
        if (!rect.width || !rect.height) continue
        const el = document.createElement('div')
        Object.assign(el.style, { position: 'absolute', left: `${rect.left + scrollX}px`, top: `${rect.top + scrollY}px`, width: `${rect.width}px`, height: `${rect.height}px`, background: color, pointerEvents: 'none' })
        overlays.append(el)
    }
}
const render = () => {
    observer?.disconnect()
    document.querySelectorAll(classes.map(c => `.${c}`).join(',')).forEach(el => el.classList.remove(...classes))
    style?.remove(); overlays?.remove()
    if (Object.values(state).some(Boolean)) {
        style = document.createElement('style'); style.dataset.supSeo = 'style'
        style.textContent = '.sup-seo-heading{outline:2px solid #38bdf8!important}.sup-seo-heading::before{content:attr(data-sup-heading) " · ";color:#0284c7!important}.sup-seo-external{outline:2px dashed #f87171!important}.sup-seo-noindex{outline:2px dashed #fbbf24!important;text-decoration:line-through!important}'
        document.documentElement.append(style)
        overlays = document.createElement('div'); overlays.dataset.supSeo = 'overlays'
        Object.assign(overlays.style, { position: 'absolute', top: '0', left: '0', zIndex: '2147483646', pointerEvents: 'none' })
        document.documentElement.append(overlays)
        if (state.headings) document.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(el => { el.classList.add(classes[0]); el.dataset.supHeading = el.tagName })
        if (state.external) document.querySelectorAll('a[href]').forEach(el => { if (/^https?:/.test(el.href) && el.hostname !== location.hostname) el.classList.add(classes[1]) })
        if (state.noindex) {
            document.querySelectorAll('noindex,a[rel]').forEach(el => { if (el.tagName === 'NOINDEX' || /\b(nofollow|ugc|sponsored)\b/i.test(el.rel)) el.classList.add(classes[2]) })
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_COMMENT), stack = []; let node
            while ((node = walker.nextNode())) {
                if (/^\s*noindex\s*$/i.test(node.data)) stack.push(node)
                else if (/^\s*\/noindex\s*$/i.test(node.data) && stack.length) {
                    const range = document.createRange(); range.setStartAfter(stack.pop()); range.setEndBefore(node); rects(range, '#fbbf2426')
                }
            }
        }
        if (state.alt || state.downloads) for (const image of [...document.images].slice(0, 1000)) {
            const rect = image.getBoundingClientRect()
            if (!rect.width || !rect.height || getComputedStyle(image).visibility === 'hidden') continue
            const labels = document.createElement('div')
            Object.assign(labels.style, { position: 'absolute', left: `${rect.left + scrollX}px`, top: `${rect.top + scrollY}px`, maxWidth: '300px', display: 'flex', flexWrap: 'wrap', gap: '4px', background: '#0f172a', color: '#f8fafc', padding: '3px 6px', font: '12px sans-serif', borderRadius: '4px' })
            if (state.alt) {
                const label = document.createElement('span')
                label.textContent = image.hasAttribute('alt') ? `alt: ${image.alt || '(пустой)'}` : 'alt отсутствует'
                labels.append(label)
            }
            const url = image.currentSrc || image.src
            if (state.downloads && /^https?:\/\//.test(url)) {
                const link = document.createElement('a')
                link.href = url; link.textContent = 'Скачать'; link.dataset.supSeoDownload = 'true'
                Object.assign(link.style, { color: '#7dd3fc', cursor: 'pointer', pointerEvents: 'auto', textDecoration: 'underline' })
                link.addEventListener('click', async event => {
                    event.preventDefault(); event.stopPropagation()
                    try {
                        const response = await chrome.runtime.sendMessage({ type: 'seo:downloadImage', payload: { url } })
                        if (!response?.ok) throw new Error(response?.error || 'Не удалось скачать изображение')
                        link.textContent = 'Скачивается…'
                    } catch (error) { link.textContent = 'Ошибка скачивания'; link.title = error.message }
                })
                labels.append(link)
            }
            if (labels.childNodes.length) overlays.append(labels)
        }
    }
    if (state.external || state.headings || state.noindex || state.alt || state.downloads) {
        observer ||= new MutationObserver(() => { if (!scheduled) { scheduled = true; requestAnimationFrame(() => { scheduled = false; render() }) } })
        observer.observe(document.body, { childList: true, subtree: true })
    }
}
const refreshImageLabels = () => {
    if (!(state.alt || state.downloads) || scheduled) return
    scheduled = true
    requestAnimationFrame(() => { scheduled = false; render() })
}
addEventListener('resize', refreshImageLabels)
addEventListener('scroll', refreshImageLabels, true)
addEventListener('load', refreshImageLabels, true)
export const getSeoActions = () => ({ ...state })
export const setSeoAction = ({ action, enabled }) => {
    if (!(action in state)) throw new Error('Неизвестное действие SEO')
    state[action] = Boolean(enabled)
    if (action === 'css') {
        if (enabled) for (const sheet of document.styleSheets) {
            if (sheet.ownerNode?.dataset?.supSeo) continue
            if (!sheets.has(sheet)) sheets.set(sheet, sheet.disabled)
            sheet.disabled = true
        }
        else { for (const [sheet, disabled] of sheets) sheet.disabled = disabled; sheets.clear() }
    }
    render(); return getSeoActions()
}
addEventListener('pagehide', () => { observer?.disconnect(); style?.remove(); overlays?.remove(); for (const [sheet, disabled] of sheets) sheet.disabled = disabled; for (const key in state) state[key] = false })

import { extensionApi } from '../platform/extensionApi.js'

export const createImageAnnotations = (doc = document) => {
    const records = new Map(), visible = new Set()
    let root, intersection, resize, frame = 0, options = { alt: false, downloads: false }
    const makeRoot = () => {
        if (root?.isConnected) return root
        root = doc.createElement('div'); root.dataset.supSeo = 'image-overlays'
        Object.assign(root.style, { position: 'absolute', top: '0', left: '0', zIndex: '2147483646', pointerEvents: 'none' })
        doc.documentElement.append(root)
        return root
    }
    const labelFor = (image, record) => {
        if (record.label) return record.label
        const label = doc.createElement('div'), text = doc.createElement('span'), link = doc.createElement('a')
        Object.assign(label.style, { position: 'absolute', maxWidth: '300px', display: 'flex', flexWrap: 'wrap', gap: '4px', background: '#0f172a', color: '#f8fafc', padding: '3px 6px', font: '12px sans-serif', borderRadius: '4px' })
        link.dataset.supSeoDownload = 'true'; link.textContent = 'Скачать'
        Object.assign(link.style, { color: '#7dd3fc', cursor: 'pointer', pointerEvents: 'auto', textDecoration: 'underline' })
        link.addEventListener('click', async event => {
            event.preventDefault(); event.stopPropagation()
            try {
                const response = await extensionApi.runtime.sendMessage({ type: 'seo:downloadImage', payload: { url: image.currentSrc || image.src } })
                if (!response?.ok) throw new Error(response?.error || 'Не удалось скачать изображение')
                link.textContent = 'Скачивается…'
            } catch (error) { link.textContent = 'Ошибка скачивания'; link.title = error.message }
        })
        label.append(text, link)
        Object.assign(record, { label, text, link })
        return label
    }
    const update = () => {
        frame = 0
        if (!options.alt && !options.downloads) return
        // Read geometry first, then update labels to avoid alternating layout reads/writes.
        const geometry = [...visible].filter(image => image.isConnected).map(image => [image, image.getBoundingClientRect(), getComputedStyle(image).visibility])
        for (const [image, rect, visibility] of geometry) {
            const record = records.get(image)
            if (!record) continue
            if (!rect.width || !rect.height || visibility === 'hidden' || visibility === 'collapse') { record.label?.remove(); continue }
            const label = labelFor(image, record)
            const left = `${rect.left + scrollX}px`, top = `${rect.top + scrollY}px`
            if (record.left !== left) { label.style.left = left; record.left = left }
            if (record.top !== top) { label.style.top = top; record.top = top }
            const text = image.hasAttribute('alt') ? `alt: ${image.alt || '(пустой)'}` : 'alt отсутствует'
            if (record.text.textContent !== text) record.text.textContent = text
            record.text.hidden = !options.alt
            const url = image.currentSrc || image.src
            record.link.hidden = !options.downloads || !/^https?:\/\//.test(url)
            if (!record.link.hidden && record.link.getAttribute('href') !== url) { record.link.href = url; record.link.textContent = 'Скачать'; record.link.removeAttribute('title') }
            if (!label.isConnected) makeRoot().append(label)
        }
    }
    const schedule = () => { if (!frame && (options.alt || options.downloads)) frame = requestAnimationFrame(update) }
    const clear = () => {
        intersection?.disconnect(); resize?.disconnect(); intersection = resize = null
        cancelAnimationFrame(frame); frame = 0
        root?.remove(); root = null; records.clear(); visible.clear()
        options = { alt: false, downloads: false }
    }
    const configure = next => {
        options = { alt: Boolean(next.alt), downloads: Boolean(next.downloads) }
        if (!options.alt && !options.downloads) { clear(); return }
        if (!intersection) intersection = new IntersectionObserver(entries => {
            for (const entry of entries) {
                if (entry.isIntersecting) visible.add(entry.target)
                else { visible.delete(entry.target); records.get(entry.target)?.label?.remove() }
            }
            schedule()
        }, { rootMargin: '160px' })
        resize ||= new ResizeObserver(schedule)
        const images = new Set(doc.images)
        for (const [image, record] of records) if (!images.has(image)) {
            intersection.unobserve(image); resize.unobserve(image); record.label?.remove(); records.delete(image); visible.delete(image)
        }
        for (const image of images) if (!records.has(image)) { records.set(image, {}); intersection.observe(image); resize.observe(image) }
        schedule()
    }
    return { configure, schedule, clear }
}

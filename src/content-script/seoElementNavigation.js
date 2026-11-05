import { seoImageSource } from '../utils/seoDom.js'

let headings = [], blinking = null, nextImageId = 0
const imageIds = new WeakMap()
let images = new Map()

export const captureHeadings = () => { headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')] }
export const captureImages = () => {
    images = new Map()
    return Array.from(document.images, image => {
        const id = imageIds.get(image) ?? nextImageId++
        imageIds.set(image, id)
        images.set(id, new WeakRef(image))
        return [id, image]
    })
}

const focusElement = element => {
    let visible = element.getClientRects().length > 0 && [...element.getClientRects()].some(rect => rect.width && rect.height)
    for (let parent = element; parent && visible; parent = parent.parentElement) {
        const css = getComputedStyle(parent)
        if (css.display === 'none' || (parent === element && ['hidden', 'collapse'].includes(css.visibility)) || Number(css.opacity) === 0 || css.contentVisibility === 'hidden') visible = false
        const rect = parent.getBoundingClientRect()
        if ((css.overflowY === 'hidden' || css.overflowY === 'clip') && rect.height === 0) visible = false
    }
    if (!visible) return { hidden: true }
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
    element.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'center', inline: 'nearest' })
    blinking?.cancel()
    const outline = { boxShadow: '0 0 0 4px #fbbf24' }
    blinking = reducedMotion ? element.animate([outline, outline], { duration: 1400 }) : element.animate([
        { boxShadow: '0 0 0 4px transparent' },
        outline,
        { boxShadow: '0 0 0 4px transparent' }
    ], { duration: 700, iterations: 2 })
    return { hidden: false }
}

export const focusHeading = ({ id }) => {
    const element = Number.isInteger(id) ? headings[id] : null
    if (!element?.isConnected) throw new Error('Заголовок изменился или удалён. Обновите SEO-анализ.')
    return focusElement(element)
}

export const focusImage = ({ id, src }) => {
    const image = images.get(id)?.deref()
    if (!image?.isConnected || seoImageSource(image) !== src) throw new Error('Изображение изменилось или удалено. Обновите SEO-анализ.')
    return focusElement(image)
}

addEventListener('pagehide', ({ persisted }) => {
    blinking?.cancel()
    headings = []
    if (!persisted) images.clear()
})

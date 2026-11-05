import { seoImageSource } from '../utils/seoDom.js'

let headings = [], blinking = null, nextImageId = 0
let stopWaitingForImage = null
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

const cancelHighlight = () => {
    stopWaitingForImage?.()
    blinking?.cancel()
    blinking = null
}

const highlightHeading = (element, reducedMotion) => {
    const outline = { boxShadow: '0 0 0 4px #fbbf24' }
    blinking = reducedMotion ? element.animate([outline, outline], { duration: 1400 }) : element.animate([
        { boxShadow: '0 0 0 4px transparent' },
        outline,
        { boxShadow: '0 0 0 4px transparent' }
    ], { duration: 700, iterations: 2 })
}

const highlightImage = (image, reducedMotion) => {
    let inView = false
    const stop = () => {
        observer.disconnect()
        document.removeEventListener('visibilitychange', pulse)
        clearTimeout(timeout)
        stopWaitingForImage = null
    }
    // The SEO page can request a jump before the source tab becomes active.
    const pulse = () => {
        if (stopWaitingForImage !== stop || !inView || document.hidden) return
        stop()
        if (!image.isConnected) return
        const normal = { filter: 'invert(0) sepia(0) saturate(1)' }
        const tint = { filter: 'invert(0.55) sepia(1) saturate(3)' }
        const frames = reducedMotion ? [tint, tint] : [normal, tint, normal]
        const animation = image.animate(frames, {
            composite: 'add',
            duration: reducedMotion ? 1400 : 1100,
            iterations: reducedMotion ? 1 : 2,
            easing: 'ease-in-out'
        })
        blinking = animation
        animation.onfinish = () => { if (blinking === animation) blinking = null }
    }
    const observer = new IntersectionObserver(([entry]) => {
        inView = entry.isIntersecting
        pulse()
    })
    const timeout = setTimeout(stop, 3000)
    stopWaitingForImage = stop
    document.addEventListener('visibilitychange', pulse)
    observer.observe(image)
}

const focusElement = (element, highlight) => {
    let visible = [...element.getClientRects()].some(rect => rect.width && rect.height)
    for (let parent = element; parent && visible; parent = parent.parentElement) {
        const css = getComputedStyle(parent)
        if (css.display === 'none' || (parent === element && ['hidden', 'collapse'].includes(css.visibility)) || Number(css.opacity) === 0 || css.contentVisibility === 'hidden') visible = false
        const rect = parent.getBoundingClientRect()
        if ((css.overflowY === 'hidden' || css.overflowY === 'clip') && rect.height === 0) visible = false
    }
    if (!visible) return { hidden: true }
    cancelHighlight()
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
    element.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'center', inline: 'nearest' })
    highlight(element, reducedMotion)
    return { hidden: false }
}

export const focusHeading = ({ id }) => {
    const element = Number.isInteger(id) ? headings[id] : null
    if (!element?.isConnected) throw new Error('Заголовок изменился или удалён. Обновите SEO-анализ.')
    return focusElement(element, highlightHeading)
}

export const focusImage = ({ id, src }) => {
    const image = images.get(id)?.deref()
    if (!image?.isConnected || seoImageSource(image) !== src) throw new Error('Изображение изменилось или удалено. Обновите SEO-анализ.')
    return focusElement(image, highlightImage)
}

addEventListener('pagehide', ({ persisted }) => {
    cancelHighlight()
    headings = []
    if (!persisted) images.clear()
})

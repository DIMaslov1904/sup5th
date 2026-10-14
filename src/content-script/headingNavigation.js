let headings = [], blinking = null

export const captureHeadings = () => { headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')] }
export const focusHeading = ({ id }) => {
    const element = Number.isInteger(id) ? headings[id] : null
    if (!element?.isConnected) throw new Error('Заголовок изменился или удалён. Обновите SEO-анализ.')
    let visible = element.getClientRects().length > 0 && [...element.getClientRects()].some(rect => rect.width && rect.height)
    for (let parent = element; parent && visible; parent = parent.parentElement) {
        const css = getComputedStyle(parent)
        if (css.display === 'none' || (parent === element && ['hidden', 'collapse'].includes(css.visibility)) || Number(css.opacity) === 0 || css.contentVisibility === 'hidden') visible = false
        const rect = parent.getBoundingClientRect()
        if ((css.overflowY === 'hidden' || css.overflowY === 'clip') && rect.height === 0) visible = false
    }
    if (!visible) return { hidden: true }
    element.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center', inline: 'nearest' })
    blinking?.cancel()
    blinking = element.animate([
        { boxShadow: '0 0 0 4px transparent' },
        { boxShadow: '0 0 0 4px #fbbf24' },
        { boxShadow: '0 0 0 4px transparent' }
    ], { duration: 700, iterations: 2 })
    // No persistent inline styles: the page/global heading highlight is restored automatically.
    return { hidden: false }
}
addEventListener('pagehide', () => { blinking?.cancel(); headings = [] })

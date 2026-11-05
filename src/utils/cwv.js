// Local measurements from the top document's Performance Timeline.
export const CWV_THRESHOLDS = {
    lcp: { good: 2500, poor: 4000 }, // milliseconds
    cls: { good: 0.1, poor: 0.25 }, // cumulative layout shift
    inp: { good: 200, poor: 500 }, // milliseconds
    fcp: { good: 1800, poor: 3000 } // milliseconds
}

const rating = (value, thresholds) => {
    if (value == null) return 'unknown'
    return value <= thresholds.good ? 'good' : value <= thresholds.poor ? 'needs-fix' : 'poor'
}

const describeElement = element => {
    if (!element) return null
    const name = element.tagName.toLowerCase()
    const id = element.id ? `#${element.id}` : ''
    const className = typeof element.className === 'string' ? element.className.trim() : ''
    return (name + id + (className ? `.${className.split(/\s+/).join('.')}` : '')).slice(0, 120)
}

let supported
let lcp = null
let cls = 0, sessionValue = 0, firstShift = -Infinity, previousShift = -Infinity
const interactions = new Map(), observers = []

const observe = (type, onEntries, options = {}) => {
    if (!globalThis.PerformanceObserver?.supportedEntryTypes?.includes(type)) return false
    try {
        const observer = new PerformanceObserver(list => onEntries(list.getEntries()))
        observer.observe({ type, buffered: true, ...options })
        observers.push({ observer, onEntries })
        return true
    } catch { return false }
}

const activationStart = () => performance.getEntriesByType('navigation')[0]?.activationStart || 0
const firstHiddenTime = activation => performance.getEntriesByType('visibility-state')
    .find(entry => entry.name === 'hidden' && entry.startTime >= activation)?.startTime ?? Infinity

const recordLcp = entries => {
    if (!entries.length) return
    const activation = activationStart()
    const hidden = firstHiddenTime(activation)
    for (const entry of entries) {
        if (entry.startTime >= hidden) continue
        const value = Math.max(entry.startTime - activation, 0)
        if (!lcp || value >= lcp.value) lcp = { value, element: describeElement(entry.element) }
    }
}

const recordShifts = entries => {
    for (const entry of entries) {
        if (entry.hadRecentInput) continue
        const time = entry.startTime
        // Score the largest burst. A gap of 1 s or a 5 s window starts a new burst.
        if (time - previousShift < 1000 && time - firstShift < 5000) {
            sessionValue += entry.value
        } else {
            firstShift = time
            sessionValue = entry.value
        }
        previousShift = time
        cls = Math.max(cls, sessionValue)
    }
}

const recordInteractions = entries => {
    for (const entry of entries) {
        if (!entry.interactionId) continue
        const previous = interactions.get(entry.interactionId) ?? 0
        interactions.set(entry.interactionId, Math.max(previous, entry.duration))
    }
}

const startObservers = () => {
    if (supported) return
    supported = {
        lcp: observe('largest-contentful-paint', recordLcp),
        cls: observe('layout-shift', recordShifts),
        inp: typeof performance.interactionCount === 'number' && observe('event', recordInteractions, { durationThreshold: 16 }),
        fcp: Boolean(globalThis.PerformanceObserver?.supportedEntryTypes?.includes('paint'))
    }
    // First Input Timing also includes the first interaction when it is faster than 16 ms.
    if (supported.inp) observe('first-input', recordInteractions)
}

const timing = (value, name) => value == null ? null : { value: Math.round(value), rating: rating(value, CWV_THRESHOLDS[name]) }

export const collectCwv = () => {
    startObservers()
    // Include buffered entries before a scheduled observer callback is delivered.
    for (const { observer, onEntries } of observers) onEntries(observer.takeRecords())

    const activation = activationStart()
    const paint = performance.getEntriesByType('paint').find(entry => entry.name === 'first-contentful-paint')
    const fcp = paint && paint.startTime < firstHiddenTime(activation) ? timing(Math.max(paint.startTime - activation, 0), 'fcp') : null
    const clsValue = supported.cls && (fcp || cls > 0) ? cls : null
    const interactionCount = supported.inp ? performance.interactionCount : null
    const rank = Math.floor(interactionCount / 50)
    const duration = interactionCount ? [...interactions.values()].sort((a, b) => b - a)[rank] : undefined
    return {
        lcp: lcp && { ...timing(lcp.value, 'lcp'), element: lcp.element },
        cls: clsValue,
        clsRating: rating(clsValue, CWV_THRESHOLDS.cls),
        inp: timing(duration, 'inp'),
        fcp,
        supported,
        interactionCount
    }
}

const seconds = value => value == null ? '' : `${(value / 1000).toFixed(2)} с`

export const cwvMetrics = cwv => [
    { key: 'lcp', name: 'LCP', label: 'LCP: крупнейший контент', value: seconds(cwv?.lcp?.value), rating: cwv?.lcp?.rating, unit: ' с', scale: 1000, detail: cwv?.lcp?.element ? `Элемент: ${cwv.lcp.element}` : '' },
    { key: 'cls', name: 'CLS', label: 'CLS: сдвиг макета', value: cwv?.cls?.toFixed(3) ?? '', rating: cwv?.clsRating, unit: '', scale: 1, detail: 'Максимальный суммарный сдвиг за окно до 5 с' },
    { key: 'inp', name: 'INP', label: 'INP: отклик ввода', value: cwv?.inp ? `${cwv.inp.value} мс` : '', rating: cwv?.inp?.rating, unit: ' мс', scale: 1, detail: 'Отклик на взаимодействия в этой вкладке' },
    { key: 'fcp', name: 'FCP', label: 'FCP: первая отрисовка', value: seconds(cwv?.fcp?.value), rating: cwv?.fcp?.rating, unit: ' с', scale: 1000 }
].map(({ unit, scale, detail, ...metric }) => {
    const { good, poor } = CWV_THRESHOLDS[metric.key]
    const thresholds = `Хорошо: ≤${good / scale}${unit} · Плохо: >${poor / scale}${unit}`
    const unavailable = cwv?.supported?.[metric.key] === false
        ? 'Не поддерживается браузером'
        : metric.key === 'inp' && cwv?.interactionCount === 0 ? 'Нет взаимодействий' : 'Нет данных'
    return { ...metric, hint: metric.value ? [detail, thresholds].filter(Boolean).join(' · ') : '', unavailable }
})

const RATING_STATUS = { good: 'pass', 'needs-fix': 'warning', poor: 'fail' }
export const cwvRatingStatus = rating => RATING_STATUS[rating] || 'unknown'

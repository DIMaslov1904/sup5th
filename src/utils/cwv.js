// Core Web Vitals collection via the Performance API.
// LCP, CLS, INP and long tasks are delivered only to PerformanceObserver, even
// with `buffered: true`; getEntriesByType returns nothing for these types.
// Observers live for the lifetime of the injected content script and keep
// running totals, so repeated scans neither add listeners nor lose entries.

// Google thresholds: good ≤ good, needs improvement ≤ poor, poor above.
export const CWV_THRESHOLDS = {
    lcp: { good: 2500, poor: 4000 }, // milliseconds
    cls: { good: 0.05, poor: 0.25 }, // cumulative layout shift
    inp: { good: 200, poor: 500 }, // milliseconds
    fcp: { good: 1800, poor: 3000 } // milliseconds
}

const rating = (value, thresholds) => {
    if (value == null) return 'unknown'
    return value <= thresholds.good ? 'good' : value <= thresholds.poor ? 'needs-fix' : 'poor'
}

// Short readable selector for the reported LCP element.
const describeElement = element => {
    try {
        const name = element.tagName.toLowerCase()
        const id = element.id ? `#${element.id}` : ''
        const className = typeof element.className === 'string' ? element.className.trim() : ''
        return (name + id + (className ? `.${className.split(/\s+/).join('.')}` : '')).slice(0, 120)
    } catch { return null }
}

let observersStarted = false
let lcpEntries = []
let clsValue = 0
let maxEventDuration = 0
let maxTaskDuration = 0

const observe = (type, onEntries) => {
    try {
        new PerformanceObserver(list => onEntries(list.getEntries())).observe({ type, buffered: true })
    } catch { /* entry type is not supported by this browser */ }
}

const startObservers = () => {
    if (observersStarted || typeof PerformanceObserver === 'undefined') return
    observersStarted = true
    observe('largest-contentful-paint', entries => { lcpEntries.push(...entries) })
    observe('layout-shift', entries => {
        for (const entry of entries) if (!entry.hadRecentInput) clsValue += entry.value
    })
    observe('event', entries => {
        for (const entry of entries) maxEventDuration = Math.max(maxEventDuration, entry.duration)
    })
    observe('longtask', entries => {
        for (const entry of entries) maxTaskDuration = Math.max(maxTaskDuration, entry.duration)
    })
}

// Buffered observer callbacks arrive on a later task, so the first scan waits
// briefly before reading the collected totals.
export const waitForCwv = () => {
    startObservers()
    return new Promise(resolve => setTimeout(resolve, 150))
}

const collectFcp = () => {
    const entry = performance.getEntriesByType('paint').find(item => item.name === 'first-contentful-paint')
    return entry ? { value: Math.round(entry.startTime), rating: rating(entry.startTime, CWV_THRESHOLDS.fcp) } : null
}

export const collectCwv = () => {
    startObservers()
    const last = lcpEntries[lcpEntries.length - 1]
    const lcp = last
        ? { value: Math.round(last.startTime), rating: rating(last.startTime, CWV_THRESHOLDS.lcp), element: describeElement(last.element) }
        : null
    const cls = Math.round(clsValue * 1000) / 1000
    const inp = maxEventDuration > 0
        ? { value: Math.round(maxEventDuration), rating: rating(maxEventDuration, CWV_THRESHOLDS.inp) }
        : maxTaskDuration > 0
            ? { value: Math.round(maxTaskDuration), rating: rating(maxTaskDuration, CWV_THRESHOLDS.inp), note: 'Approximated from longtask entries (INP not directly available)' }
            : null
    return { lcp, cls, clsRating: rating(cls, CWV_THRESHOLDS.cls), inp, fcp: collectFcp() }
}

const RATING_STATUS = { good: 'pass', 'needs-fix': 'warning', poor: 'fail', unknown: 'unknown' }
export const cwvRatingStatus = rating => RATING_STATUS[rating] || 'unknown'

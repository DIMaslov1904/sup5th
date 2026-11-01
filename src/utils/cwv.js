// Core Web Vitals collection via the Performance API.
// A report is a snapshot of the current navigation: no observer outlives the
// scan, so repeated scans neither accumulate work nor miss buffered entries.

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

const collectLcp = () => {
    const entries = performance.getEntriesByType('largest-contentful-paint')
    const last = entries[entries.length - 1]
    if (!last) return null
    return { value: Math.round(last.startTime), rating: rating(last.startTime, CWV_THRESHOLDS.lcp), element: describeElement(last.element) }
}

// Layout shifts are read from the timeline; `hadRecentInput` excludes induced shifts.
const collectCls = () => {
    let cls = 0
    for (const entry of performance.getEntriesByType('layout-shift')) if (!entry.hadRecentInput) cls += entry.value
    return Math.round(cls * 1000) / 1000
}

const collectInp = () => {
    let max = 0
    for (const entry of performance.getEntriesByType('event')) max = Math.max(max, entry.duration)
    if (max > 0) return { value: Math.round(max), rating: rating(max, CWV_THRESHOLDS.inp) }
    // INP entries are not always exposed; the longest task is the closest estimate.
    for (const entry of performance.getEntriesByType('longtask')) max = Math.max(max, entry.duration)
    return max > 0
        ? { value: Math.round(max), rating: rating(max, CWV_THRESHOLDS.inp), note: 'Approximated from longtask entries (INP not directly available)' }
        : null
}

const collectFcp = () => {
    const entry = performance.getEntriesByType('paint').find(item => item.name === 'first-contentful-paint')
    return entry ? { value: Math.round(entry.startTime), rating: rating(entry.startTime, CWV_THRESHOLDS.fcp) } : null
}

export const collectCwv = () => {
    const cls = collectCls()
    return { lcp: collectLcp(), cls, clsRating: rating(cls, CWV_THRESHOLDS.cls), inp: collectInp(), fcp: collectFcp() }
}

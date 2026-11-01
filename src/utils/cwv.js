// Core Web Vitals collection via Performance API and Observers.
// All metrics are measured on the live page; values are snapshots
// that reflect the current navigation's performance.

// CWV rating thresholds (Google recommendations)
const CWV_THRESHOLDS = {
    lcp: { good: 2500, poor: 4000 },       // milliseconds
    cls: { good: 0.05, poor: 0.25 },        // cumulative layout shift
    inp: { good: 200, poor: 500 },          // milliseconds
    fcp: { good: 1800, poor: 3000 }         // milliseconds
}

const rating = (value, thresholds) => {
    if (value == null) return 'unknown'
    return value <= thresholds.good ? 'good' : value <= thresholds.poor ? 'needs-fix' : 'poor'
}

/**
 * Collect CLS from PerformanceObserver buffered entries.
 * Must be called early to capture buffered layout-shift entries.
 */
const collectCls = () => {
    try {
        const layoutShifts = performance.getEntriesByType('layout-shift')
        let cls = 0
        for (const entry of layoutShifts) {
            if (!entry.hadRecentInput) {
                cls += entry.value
            }
        }
        return Math.round(cls * 1000) / 1000
    } catch {
        return null
    }
}

/**
 * Collect Core Web Vitals metrics from the current page.
 * Returns a snapshot object with LCP, CLS, INP, FCP.
 * CLS collection is async to allow PerformanceObserver setup.
 */
export const collectCwv = async (doc = document) => {
    const cwv = { lcp: null, cls: 0, inp: null, fcp: null }

    // --- LCP (Largest Contentful Paint) ---
    try {
        const lcpEntries = performance.getEntriesByType('largest-contentful-paint')
        if (lcpEntries && lcpEntries.length > 0) {
            const last = lcpEntries[lcpEntries.length - 1]
            cwv.lcp = {
                value: last.startTime,
                rating: rating(last.startTime, CWV_THRESHOLDS.lcp),
                element: null // Will be populated below
            }
        }
    } catch { /* LCP not supported */ }

    // Try to find the LCP element by scanning for large visible elements
    if (cwv.lcp && !cwv.lcp.element) {
        try {
            const body = doc.body
            if (body) {
                const candidates = []

                // Check images
                for (const img of body.querySelectorAll('img, video, picture')) {
                    const rect = img.getBoundingClientRect()
                    if (rect.width > 0 && rect.height > 0 && rect.width <= 4000 && rect.height <= 4000) {
                        candidates.push({
                            area: rect.width * rect.height,
                            selector: img.tagName.toLowerCase() + (img.id ? `#${img.id}` : '') + (img.className && typeof img.className === 'string' ? `.${img.className.trim().split(/\s+/).join('.')}` : '') + (img.src ? `[src="${new URL(img.src, doc.baseURI).pathname}"]` : '')
                        })
                    }
                }

                // Check text blocks (large paragraphs, headings)
                for (const el of body.querySelectorAll('h1, h2, h3, p, article, section, main')) {
                    const rect = el.getBoundingClientRect()
                    if (rect.width > 0 && rect.height > 0 && rect.width <= 4000 && rect.height <= 4000) {
                        const textNodes = [...el.childNodes].filter(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim().length > 0)
                        if (textNodes.length > 0 || el.querySelector('img, video')) {
                            candidates.push({
                                area: rect.width * rect.height,
                                selector: el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '') + (el.className && typeof el.className === 'string' ? `.${el.className.trim().split(/\s+/).join('.')}` : '')
                            })
                        }
                    }
                }

                candidates.sort((a, b) => b.area - a.area)
                if (candidates.length > 0) {
                    cwv.lcp.element = candidates[0].selector.slice(0, 120)
                }
            }
        } catch { /* Element detection failed, element stays null */ }
    }

    // --- CLS (Cumulative Layout Shift) ---
    // Use PerformanceObserver with buffered: true to capture past layout shifts
    try {
        let cls = 0
        const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                if (!entry.hadRecentInput) {
                    cls += entry.value
                }
            }
        })
        observer.observe({ type: 'layout-shift', buffered: true })
        observer.disconnect()
        cwv.cls = Math.round(cls * 1000) / 1000
    } catch { /* LayoutShift not supported */ }

    cwv.clsRating = rating(cwv.cls, CWV_THRESHOLDS.cls)

    // --- INP (Interaction to Next Paint) ---
    try {
        const eventEntries = performance.getEntriesByType('event')
        if (eventEntries && eventEntries.length > 0) {
            let maxDuration = 0
            for (const entry of eventEntries) {
                if (entry.duration > maxDuration) {
                    maxDuration = entry.duration
                }
            }
            if (maxDuration > 0) {
                cwv.inp = {
                    value: maxDuration,
                    rating: rating(maxDuration, CWV_THRESHOLDS.inp)
                }
            }
        }
    } catch { /* Event entries not supported */ }

    // Fallback: if 'event' entries are not available, try to use longtasks as a proxy
    if (cwv.inp == null) {
        try {
            const longTasks = performance.getEntriesByType('longtask')
            if (longTasks && longTasks.length > 0) {
                let maxDuration = 0
                for (const task of longTasks) {
                    if (task.duration > maxDuration) maxDuration = task.duration
                }
                if (maxDuration > 0) {
                    cwv.inp = {
                        value: maxDuration,
                        rating: rating(maxDuration, CWV_THRESHOLDS.inp),
                        note: 'Approximated from longtask entries (INP not directly available)'
                    }
                }
            }
        } catch { /* longtask not supported */ }
    }

    // --- FCP (First Contentful Paint) ---
    try {
        const paintEntries = performance.getEntriesByType('paint')
        if (paintEntries) {
            const fcp = paintEntries.find(entry => entry.name === 'first-contentful-paint')
            if (fcp) {
                cwv.fcp = {
                    value: fcp.startTime,
                    rating: rating(fcp.startTime, CWV_THRESHOLDS.fcp)
                }
            }
        }
    } catch { /* Paint entries not supported */ }

    return cwv
}

/**
 * Collect CLS synchronously (fallback for sync contexts).
 * May return 0 if PerformanceObserver was already set up by another script.
 */
export const collectCwvSync = (doc = document) => {
    const cwv = { lcp: null, cls: 0, inp: null, fcp: null }

    try {
        const lcpEntries = performance.getEntriesByType('largest-contentful-paint')
        if (lcpEntries && lcpEntries.length > 0) {
            const last = lcpEntries[lcpEntries.length - 1]
            cwv.lcp = {
                value: last.startTime,
                rating: rating(last.startTime, CWV_THRESHOLDS.lcp),
                element: null
            }
        }
    } catch { /* LCP not supported */ }

    // CLS fallback: try getEntriesByType (may be empty if observer was set)
    try {
        const layoutShifts = performance.getEntriesByType('layout-shift')
        let cls = 0
        for (const entry of layoutShifts) {
            if (!entry.hadRecentInput) cls += entry.value
        }
        cwv.cls = Math.round(cls * 1000) / 1000
    } catch { /* LayoutShift not supported */ }

    cwv.clsRating = rating(cwv.cls, CWV_THRESHOLDS.cls)

    try {
        const paintEntries = performance.getEntriesByType('paint')
        if (paintEntries) {
            const fcp = paintEntries.find(entry => entry.name === 'first-contentful-paint')
            if (fcp) {
                cwv.fcp = {
                    value: fcp.startTime,
                    rating: rating(fcp.startTime, CWV_THRESHOLDS.fcp)
                }
            }
        }
    } catch { /* Paint entries not supported */ }

    return cwv
}

/**
 * Start observing CLS in real-time and return a cleanup function.
 * Useful for pages that continue to load after initial render.
 */
export const observeCls = (onShift, doc = document) => {
    let cls = 0
    let accumulated = 0
    const flushBuffer = () => {
        if (accumulated > 0) {
            cls += accumulated
            onShift(cls)
            accumulated = 0
        }
    }

    try {
        const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                if (!entry.hadRecentInput) {
                    accumulated += entry.value
                }
            }
            setTimeout(flushBuffer, 100)
        })
        observer.observe({ type: 'layout-shift', buffered: true })
        return () => observer.disconnect()
    } catch {
        return () => {}
    }
}

export { CWV_THRESHOLDS }

export const SUPPORT_TRACKING_KEY = 'supportTicketTracking'
export const SUPPORT_TIMER_ALARM = 'support-ticket-timer'

export const formatTicketElapsed = (startedAt, now = Date.now()) => {
    const minutes = Math.max(0, Math.floor((now - startedAt) / 60000))
    return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`
}

export const activeTicketFrom = state => state?.active || null

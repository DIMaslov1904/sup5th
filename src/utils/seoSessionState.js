export const SEO_SESSION_KEY = 'popupSeoState'
export const POPUP_EXPIRY_ALARM = 'popup-session-expire'

export const seoContextKey = context => Number.isInteger(context?.tabId)
    && /^https?:\/\//.test(context?.url || '') && typeof context?.documentId === 'string' && context.documentId
    ? JSON.stringify([context.tabId, context.url, context.documentId]) : ''

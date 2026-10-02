const AUTH_TTL = 5 * 60 * 1000

const setInputValue = (input, value) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
}

const findInput = (selectors) => selectors
    .map((selector) => document.querySelector(selector))
    .find((input) => input instanceof HTMLInputElement)

const fillAdminForm = (auth) => {
    if (Date.now() - auth.createdAt > AUTH_TTL) return false

    const login = findInput([
        '[name="USER_LOGIN"]',
        '[name="username"]',
        '[name="email"]',
        '[name="login"]',
        'input[type="email"]',
        'input[autocomplete="username"]'
    ])
    const password = findInput([
        '[name="USER_PASSWORD"]',
        '[name="password"]',
        'input[type="password"]',
        'input[autocomplete="current-password"]'
    ])
    if (!login || !password) return false

    setInputValue(login, auth.login)
    setInputValue(password, auth.password)

    if (auth.cms !== 'Tilda') {
        const submit = document.querySelector('[name="Login"], [name="login"], #send, button[type="submit"], input[type="submit"]')
        if (submit instanceof HTMLElement) submit.click()
    }
    return true
}

const startAdminAuth = async () => {
    if (window.top !== window) return
    const response = await chrome.runtime.sendMessage({ type: 'auth:consume' })
    const auth = response?.ok ? response.data : null
    if (!auth || Date.now() - auth.createdAt > AUTH_TTL) return

    if (fillAdminForm(auth)) return

    const observer = new MutationObserver(() => {
        if (!document.body || !fillAdminForm(auth)) return
        observer.disconnect()
    })
    observer.observe(document.documentElement, { childList: true, subtree: true })
    setTimeout(() => observer.disconnect(), 15000)
}

startAdminAuth().catch((error) => console.error('[content] admin auth', error))

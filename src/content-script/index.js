const visible = input => input.getClientRects().length > 0 && !input.disabled && !input.readOnly && getComputedStyle(input).visibility !== 'hidden'
const setValue = (input, value) => {
    Object.getOwnPropertyDescriptor(input.ownerDocument.defaultView.HTMLInputElement.prototype, 'value').set.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true }))
}
const findLoginForm = () => {
    const passwords = [...document.querySelectorAll('input[type="password"]')].filter(input => visible(input) && input.autocomplete !== 'new-password')
    for (const password of passwords) {
        const form = password.form, scope = form || password.closest('[role="dialog"],section,main') || password.parentElement
        const fields = [...scope.querySelectorAll('input')].filter(input => visible(input) && ['text', 'email', 'tel'].includes(input.type))
        const login = fields.find(input => input.autocomplete === 'username') || fields.find(input => /user|login|email|account/i.test(`${input.name} ${input.id}`)) || fields.at(-1)
        if (!login || (form && [...form.querySelectorAll('input[type="password"]')].filter(visible).length > 1)) continue
        return { login, password, form, scope }
    }
    return null
}
const start = async () => {
    if (window.top !== window || globalThis.__sup5thAuthInstalled) return
    globalThis.__sup5thAuthInstalled = true
    const context = await chrome.runtime.sendMessage({ type: 'auth:context' })
    if (!context?.ok || !context.data) return
    let observer, timer, cancelled = false, busy = false
    const stop = () => { cancelled = true; observer?.disconnect(); clearTimeout(timer); chrome.runtime.onMessage.removeListener(receive) }
    const receive = message => { if (message.type === 'auth:cancel') stop() }
    chrome.runtime.onMessage.addListener(receive)
    const attempt = async () => {
        if (cancelled || busy) return
        const fields = findLoginForm()
        if (!fields) return
        busy = true
        const response = await chrome.runtime.sendMessage({ type: 'auth:consume' }), auth = response?.ok ? response.data : null
        if (cancelled || !auth || Date.now() - auth.createdAt > 300000) { stop(); return }
        setValue(fields.login, auth.login); setValue(fields.password, auth.password); stop()
        if (auth.cms === 'Tilda') return
        const submit = [...fields.scope.querySelectorAll('button,input[type="submit"]')].find(button => visible(button) &&
            (button.type === 'submit' || /^(войти|вход|sign in|log in|login|вход в систему)$/i.test(button.textContent.trim())))
        if (submit) submit.click()
        else fields.form?.requestSubmit()
    }
    observer = new MutationObserver(() => attempt().catch(stop))
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'hidden', 'disabled'] })
    timer = setTimeout(stop, 15000)
    await attempt()
}
start().catch(error => console.error('[auth]', error))

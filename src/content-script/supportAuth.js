import { extensionApi } from '../platform/extensionApi.js'
import { SUPPORT_ORIGIN, SUPPORT_LOGIN_PATH, supportUrl } from '../utils/supportAuth.js'

const loginFields = () => {
    if (location.pathname !== SUPPORT_LOGIN_PATH) return null
    const login = document.querySelector('input[name="userdata[U_ID]"]')
    const password = document.querySelector('input[name="userdata[U_PASSWORD]"][type="password"]')
    const form = password?.form
    if (!form || login?.form !== form || login.disabled || login.readOnly || password.disabled || password.readOnly) return null
    const action = supportUrl(form.action)
    if (!action || action.pathname !== SUPPORT_LOGIN_PATH || form.method.toLowerCase() !== 'post') return null
    const submit = form.querySelector('input[type="submit"][name="enter"]')
    return submit && !submit.disabled ? { login, password, form, submit } : null
}
const showMessage = message => {
    let notice = document.getElementById('sup5th-support-auth-message')
    if (!notice) {
        notice = document.createElement('p')
        notice.id = 'sup5th-support-auth-message'
        notice.setAttribute('role', 'status')
        document.body.prepend(notice)
    }
    notice.textContent = `SUP 5th: ${message} Ссылка на тикет сохраняется на 5 минут для возврата после ручного входа.`
}
const setValue = (input, value) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
}

export const startSupportAuth = () => {
    if (window.top !== window || location.origin !== SUPPORT_ORIGIN) return
    let busy = false
    const run = async () => {
        if (busy) return
        busy = true
        const sourceUrl = location.href, fields = loginFields()
        try {
            const response = await extensionApi.runtime.sendMessage({ type: 'support:auth:page', payload: { loginFormReady: Boolean(fields) } })
            if (location.href !== sourceUrl) return
            if (!response?.ok) throw new Error('Не удалось проверить авторизацию. Войдите вручную.')
            const result = response.data
            if (result.action === 'manual') { showMessage(result.message); return }
            if (result.action === 'login' || result.action === 'redirect') {
                if (supportUrl(result.url)) location.replace(result.url)
                return
            }
            if (result.action !== 'submit' || !fields || loginFields()?.form !== fields.form) return
            setValue(fields.login, result.login)
            setValue(fields.password, result.password)
            const ssl = fields.form.querySelector('input[name="access"][type="checkbox"]')
            if (ssl) ssl.checked = true
            fields.form.requestSubmit(fields.submit)
        } catch (error) { showMessage(error.message) }
        finally { busy = false }
    }
    window.addEventListener('hashchange', run)
    window.addEventListener('pageshow', event => { if (event.persisted) run() })
    run()
}

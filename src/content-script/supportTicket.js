import { CREATE_TICKET_PARAM } from '../utils/projectUtils.js'

// Автоматически открываем форму только по ссылке «Создать тикет» из расширения.
export const startTicketCreation = () => {
    const url = new URL(location.href)
    if (window.top !== window || url.origin !== 'https://support.5th.ru'
        || url.pathname !== '/published/personal.php'
        || url.searchParams.get(CREATE_TICKET_PARAM) !== '1') return

    const observers = new Map(), frames = new Map()
    let finished = false
    const cleanup = () => {
        finished = true
        clearTimeout(timeout)
        observers.forEach(observer => observer.disconnect())
        frames.forEach((handler, frame) => frame.removeEventListener('load', handler))
        window.removeEventListener('pagehide', cleanup)
    }
    const check = () => {
        if (finished) return
        const documents = new Set()
        const visit = targetDoc => {
            if (!targetDoc || documents.has(targetDoc)) return
            documents.add(targetDoc)
            targetDoc.querySelectorAll('iframe').forEach(frame => {
                if (!frames.has(frame)) {
                    frames.set(frame, check)
                    frame.addEventListener('load', check)
                }
                try { visit(frame.contentDocument) }
                catch { /* Чужой origin: форма саппорта должна быть в своём документе. */ }
            })
        }
        visit(document)
        for (const targetDoc of documents) {
            if (!observers.has(targetDoc) && targetDoc.documentElement) {
                const observer = new MutationObserver(check)
                observer.observe(targetDoc.documentElement, {
                    childList: true, subtree: true, attributes: true,
                    attributeFilter: ['class', 'style', 'disabled', 'hidden', 'aria-disabled']
                })
                observers.set(targetDoc, observer)
            }
            const button = targetDoc.getElementById('add-request-link')
            if (!button || typeof button.click !== 'function' || button.disabled
                || button.getAttribute('aria-disabled') === 'true' || !button.getClientRects().length
                || targetDoc.defaultView.getComputedStyle(button).visibility === 'hidden') continue

            cleanup()
            // Убираем команду до клика, чтобы обновление страницы не открыло форму снова.
            const currentUrl = new URL(location.href)
            currentUrl.searchParams.delete(CREATE_TICKET_PARAM)
            history.replaceState(history.state, '', currentUrl.href)
            button.click()
            return
        }
    }
    const timeout = setTimeout(() => {
        cleanup()
        console.warn('[support] Кнопка создания тикета не появилась за 30 секунд')
    }, 30000)
    window.addEventListener('pagehide', cleanup, { once: true })
    check()
}

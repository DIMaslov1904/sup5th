const frameBody = document.getElementById('body-frame')
let doc = document
let iframe = null
let ticketId = null
const observedRoots = new WeakSet()

const styles = `
.sup5th-support-modal{border:0;padding:0;border-radius:8px;max-width:none;max-height:none;opacity:0;transform:scale(.98);transition:transform .18s ease,opacity .18s ease}
.sup5th-support-modal[open]{opacity:1;transform:scale(1)}
.sup5th-support-modal::backdrop{background:rgb(39 39 39 / 40%)}
.sup5th-support-modal__wrapper{position:relative;padding:40px 48px 48px}
.sup5th-support-modal__close{position:absolute;top:12px;right:12px;width:32px;height:32px;border:0;border-radius:8px;background:transparent;cursor:pointer}
.sup5th-support-modal__close::before,.sup5th-support-modal__close::after{content:"";position:absolute;top:15px;left:7px;width:18px;height:1px;background:#111;transform:rotate(45deg)}
.sup5th-support-modal__close::after{transform:rotate(-45deg)}
.sup5th-support-modal__iframe{display:block;width:90vw;height:90dvh;margin:-40px -48px -48px;border:0}
.sup5th-duration{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px;padding:8px 10px;border:1px solid #cbd5e1;border-radius:4px;background:#fff;font:13px Arial,sans-serif;color:#334155}
.sup5th-duration__title{font-weight:600}
.sup5th-duration__input{box-sizing:border-box;width:64px;padding:5px 6px;border:1px solid #cbd5e1;border-radius:4px;font:inherit}
.sup5th-duration__summary{flex-basis:100%;color:#64748b;font-size:12px}
.sup5th-duration__error{flex-basis:100%;color:#b91c1c;font-size:12px;font-weight:600}
.ui-button.edit-time-taskt:hover{border-color:#84bdde;background-image:url("images/ui-bg_glass_75_c6e9fe_1x400.png");color:#111;box-shadow:inset 0 1px 0 #fff,inset 0 -1px 0 #f2faff}
`

const ensureStyles = (targetDoc) => {
    if (!targetDoc?.head || targetDoc.getElementById('sup5th-support-styles')) return
    const style = targetDoc.createElement('style')
    style.id = 'sup5th-support-styles'
    style.textContent = styles
    targetDoc.head.append(style)
}

const createModal = () => {
    ensureStyles(document)
    const dialog = document.createElement('dialog')
    const wrapper = document.createElement('div')
    const closeButton = document.createElement('button')

    dialog.id = 'sup5th-support-worklog-modal'
    dialog.className = 'sup5th-support-modal'
    wrapper.className = 'sup5th-support-modal__wrapper'
    closeButton.type = 'button'
    closeButton.className = 'sup5th-support-modal__close'
    closeButton.setAttribute('aria-label', 'Закрыть')
    closeButton.addEventListener('click', closeModal)
    dialog.addEventListener('click', (event) => {
        if (event.target === dialog) closeModal()
    })
    dialog.addEventListener('cancel', (event) => {
        event.preventDefault()
        closeModal()
    })
    wrapper.append(closeButton)
    dialog.append(wrapper)
    document.body.append(dialog)
    return dialog
}

const pad = (value) => String(value).padStart(2, '0')

const formatSupportDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`

const parseSupportDate = (value) => {
    if (!value?.trim()) return null
    const normalized = value.trim().replace(' ', 'T')
    const localized = value.trim().match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
    const date = localized
        ? new Date(Number(localized[3]), Number(localized[2]) - 1, Number(localized[1]), Number(localized[4]), Number(localized[5]), Number(localized[6] || 0))
        : new Date(normalized)
    return Number.isNaN(date.getTime()) ? null : date
}

const formatDuration = (minutes) => {
    let seconds = Math.max(0, Math.floor(minutes * 60))
    let result = ''
    const days = Math.floor(seconds / 86400)
    if (days) result += `${days} дн `
    seconds -= days * 86400
    const hours = Math.floor(seconds / 3600)
    if (hours) result += `${hours} ч `
    seconds -= hours * 3600
    const remainderMinutes = Math.floor(seconds / 60)
    if (remainderMinutes) result += `${remainderMinutes} м `
    seconds -= remainderMinutes * 60
    if (seconds) result += `${seconds} с`
    return result.trim() || '0 с'
}

const setField = (input, value) => {
    input.value = value
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
}

const enhanceTimeFields = (targetDoc) => {
    ensureStyles(targetDoc)
    const startInput = targetDoc.querySelector('input[name*="time_start"], input[name*="start_time"]')
    const endInput = startInput?.closest('tr')?.querySelector('input[name*="time_end"], input[name*="end_time"]')
        || targetDoc.querySelector('input[name*="time_end"], input[name*="end_time"]')
    if (!(startInput instanceof HTMLInputElement) || !(endInput instanceof HTMLInputElement)) return
    if (targetDoc.querySelector('.sup5th-duration')) return

    const duration = targetDoc.createElement('div')
    duration.className = 'sup5th-duration'
    const title = targetDoc.createElement('span')
    title.className = 'sup5th-duration__title'
    title.textContent = 'Время выполнения'

    const hoursInput = targetDoc.createElement('input')
    hoursInput.className = 'sup5th-duration__input'
    hoursInput.type = 'number'
    hoursInput.min = '0'
    hoursInput.max = '720'
    hoursInput.step = '1'
    hoursInput.inputMode = 'numeric'
    hoursInput.setAttribute('aria-label', 'Часы выполнения')
    hoursInput.placeholder = '0'

    const hoursLabel = targetDoc.createElement('span')
    hoursLabel.textContent = 'ч'

    const minutesInput = targetDoc.createElement('input')
    minutesInput.className = 'sup5th-duration__input'
    minutesInput.type = 'number'
    minutesInput.min = '0'
    minutesInput.max = '59'
    minutesInput.step = '1'
    minutesInput.inputMode = 'numeric'
    minutesInput.setAttribute('aria-label', 'Минуты выполнения')
    minutesInput.placeholder = '0'

    const minutesLabel = targetDoc.createElement('span')
    minutesLabel.textContent = 'мин'

    const summary = targetDoc.createElement('span')
    summary.className = 'sup5th-duration__summary'
    const error = targetDoc.createElement('span')
    error.className = 'sup5th-duration__error'

    const initialStart = parseSupportDate(startInput.value)
    const initialEnd = parseSupportDate(endInput.value)
    if (initialStart && initialEnd && initialEnd >= initialStart) {
        const totalMinutes = Math.floor((initialEnd.getTime() - initialStart.getTime()) / 60000)
        hoursInput.value = String(Math.floor(totalMinutes / 60))
        minutesInput.value = String(totalMinutes % 60)
    }

    let updatingFields = false
    const renderDates = () => {
        const start = parseSupportDate(startInput.value)
        const end = parseSupportDate(endInput.value)
        const invalid = !start || !end || end < start
        startInput.style.border = invalid ? '1px solid #dc2626' : ''
        endInput.style.border = invalid ? '1px solid #dc2626' : ''

        if (!start) error.textContent = 'Укажите дату и время начала.'
        else if (!end) error.textContent = 'Укажите длительность или дату окончания.'
        else if (end < start) error.textContent = 'Дата окончания раньше даты начала.'
        else error.textContent = ''

        if (start && end && end >= start) {
            const totalMinutes = Math.floor((end.getTime() - start.getTime()) / 60000)
            hoursInput.value = String(Math.floor(totalMinutes / 60))
            minutesInput.value = String(totalMinutes % 60)
            summary.textContent = `Продолжительность: ${formatDuration((end.getTime() - start.getTime()) / 60000)}`
        } else {
            summary.textContent = ''
        }
    }

    const updateDuration = () => {
        const parsedHours = Number(hoursInput.value || 0)
        const parsedMinutes = Number(minutesInput.value || 0)
        const invalid = !Number.isInteger(parsedHours) || !Number.isInteger(parsedMinutes) || parsedHours < 0 || parsedHours > 720 || parsedMinutes < 0 || parsedMinutes > 59
        hoursInput.setCustomValidity(invalid ? 'Укажите положительную длительность, минуты от 0 до 59.' : '')
        if (invalid) {
            error.textContent = 'Проверьте длительность: часы от 0 до 720, минуты от 0 до 59.'
            return
        }
        const hours = parsedHours
        const minutes = parsedMinutes
        const totalMinutes = hours * 60 + minutes
        if (totalMinutes <= 0) {
            renderDates()
            return
        }

        const existingStart = parseSupportDate(startInput.value)
        const start = existingStart || new Date()
        const end = new Date(start.getTime() + totalMinutes * 60000)
        updatingFields = true
        if (!existingStart) setField(startInput, formatSupportDate(start))
        setField(endInput, formatSupportDate(end))
        updatingFields = false
        renderDates()
    }

    hoursInput.addEventListener('input', updateDuration)
    minutesInput.addEventListener('input', updateDuration)
    duration.append(title, hoursInput, hoursLabel, minutesInput, minutesLabel, summary, error)

    endInput.insertAdjacentElement('afterend', duration)

    const restoreCalendarInput = (input) => {
        if (input.dataset.sup5thTimeEnhanced) return
        input.dataset.sup5thTimeEnhanced = 'true'
        input.addEventListener('focus', () => {
            const parsed = parseSupportDate(input.value)
            input.type = 'datetime-local'
            input.step = '1'
            input.value = parsed ? `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}:${pad(parsed.getSeconds())}` : ''
        })
        input.addEventListener('input', () => {
            if (updatingFields) return
            renderDates()
        })
        input.addEventListener('change', () => {
            if (updatingFields) return
            renderDates()
        })
        input.addEventListener('blur', () => {
            const parsed = parseSupportDate(input.value)
            input.type = 'text'
            if (parsed) input.value = formatSupportDate(parsed)
            renderDates()
        })
    }
    restoreCalendarInput(startInput)
    restoreCalendarInput(endInput)
    renderDates()
}

const createIframe = (id) => {
    const frame = document.createElement('iframe')
    frame.className = 'sup5th-support-modal__iframe'
    frame.src = `https://support.5th.ru/published/sta/work_log_edit.php?request_id=${encodeURIComponent(id)}`
    frame.addEventListener('load', () => {
        try {
            const frameDoc = frame.contentWindow?.document
            if (frameDoc) enhanceTimeFields(frameDoc)
        } catch (error) {
            console.error('[support] Cannot access work-log iframe', error)
        }
    })
    return frame
}

const getRequestIdFromUrl = () => {
    const parts = window.location.hash.split('/')
    if (parts[parts.length - 2] === 'id') return parts[parts.length - 1]
    return doc.querySelector('.date.request-id b')?.textContent?.trim() || ''
}

const onOpenModal = () => {
    ticketId = getRequestIdFromUrl()
    if (!ticketId) return
    iframe?.remove()
    iframe = createIframe(ticketId)
    modal.querySelector('.sup5th-support-modal__wrapper')?.append(iframe)
}

const onCloseModal = () => {
    iframe?.remove()
    iframe = null
    const rowTicket = ticketId ? doc.querySelector(`[rel="${CSS.escape(ticketId)}"]`) : null
    if (rowTicket) {
        rowTicket.dispatchEvent(new Event('mousedown'))
        return
    }
    const iframeLocation = frameBody?.contentWindow?.location
        ; (iframeLocation || location).reload()
}

const closeModal = () => {
    if (modal?.open) modal.close()
    onCloseModal()
}

const openModal = () => {
    if (!modal || modal.open) return
    onOpenModal()
    if (ticketId) modal.showModal()
}

const createButton = () => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'ui-button ui-widget ui-state-default ui-corner-all ui-button-text-only edit-time-taskt'
    button.setAttribute('role', 'button')
    const label = document.createElement('span')
    label.className = 'ui-button-text'
    label.textContent = 'Редактировать'
    button.append(label)
    button.addEventListener('click', openModal)
    button.addEventListener('mouseover', () => button.classList.add('ui-state-hover'))
    button.addEventListener('mouseout', () => button.classList.remove('ui-state-hover'))
    return button
}

const ensureButtons = () => {
    doc.querySelectorAll('.ticket-toolbar-bg .buttons').forEach((wrap) => {
        if (wrap.querySelector(':scope > .edit-time-taskt')) return
        const button = createButton()
        button.dataset.sup5thSupportButton = 'true'
        wrap.insertBefore(button, wrap.firstChild)
    })
}

const waitForElement = (selector, targetDoc) => new Promise((resolve) => {
    const existing = targetDoc.querySelector(selector)
    if (existing) {
        resolve(existing)
        return
    }
    const root = targetDoc.documentElement || targetDoc
    const observer = new MutationObserver(() => {
        const element = targetDoc.querySelector(selector)
        if (!element) return
        observer.disconnect()
        resolve(element)
    })
    observer.observe(root, { childList: true, subtree: true })
})

const startObserverTicketWrapper = async () => {
    const ticketWrapper = await waitForElement('#ticket-wrapper', doc)
    const observerRoot = ticketWrapper.parentElement || ticketWrapper
    if (observedRoots.has(observerRoot)) {
        ensureButtons()
        return
    }

    observedRoots.add(observerRoot)
    ensureButtons()
    new MutationObserver(() => ensureButtons()).observe(observerRoot, {
        childList: true,
        subtree: true
    })
}

const modal = createModal()

if (frameBody instanceof HTMLIFrameElement) {
    frameBody.addEventListener('load', () => {
        try {
            doc = frameBody.contentWindow?.document || document
            startObserverTicketWrapper().catch((error) => console.error('[support] Cannot observe iframe ticket', error))
        } catch (error) {
            console.error('[support] Cannot access ticket iframe', error)
        }
    })
    if (frameBody.contentDocument?.readyState === 'complete') {
        doc = frameBody.contentDocument
        startObserverTicketWrapper().catch((error) => console.error('[support] Cannot observe iframe ticket', error))
    }
} else {
    startObserverTicketWrapper().catch((error) => console.error('[support] Cannot observe ticket', error))
}

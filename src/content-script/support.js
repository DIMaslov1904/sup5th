import { startTicketCreation } from './supportTicket.js'

startTicketCreation()

const frameBody = document.getElementById('body-frame')
let doc = document
let iframe = null
let ticketId = null
const observedRoots = new WeakSet()
const enhancedTimePairs = new WeakSet()

const styles = `
.sup5th-support-modal{border:0;padding:0;border-radius:8px;max-width:none;max-height:none;opacity:0;transform:scale(.98);transition:transform .18s ease,opacity .18s ease}
.sup5th-support-modal[open]{opacity:1;transform:scale(1)}
.sup5th-support-modal::backdrop{background:rgb(39 39 39 / 40%)}
.sup5th-support-modal__wrapper{position:relative;padding:40px 48px 48px}
.sup5th-support-modal__close{position:absolute;top:12px;right:12px;width:32px;height:32px;border:0;border-radius:8px;background:transparent;cursor:pointer}
.sup5th-support-modal__close::before,.sup5th-support-modal__close::after{content:"";position:absolute;top:15px;left:7px;width:18px;height:1px;background:#111;transform:rotate(45deg)}
.sup5th-support-modal__close::after{transform:rotate(-45deg)}
.sup5th-support-modal__iframe{display:block;width:90vw;height:90dvh;margin:-40px -48px -48px;border:0}
.sup5th-duration{display:grid;gap:8px;margin-top:8px;padding:8px 10px;border:1px solid #aaa;background:#fff;grid-template-columns:64px auto}
.sup5th-duration__title{grid-column:1/-1;font-weight:600}
.sup5th-duration__input{box-sizing:border-box;width:64px;padding:5px 6px;border:1px solid #cbd5e1;border-radius:4px;font:inherit}
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

const toLocalValue = (parsed) => `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}:${pad(parsed.getSeconds())}`

const isTimeLikeInput = (input) => {
    const InputElement = input?.ownerDocument?.defaultView?.HTMLInputElement
    if (!InputElement || !(input instanceof InputElement)) return false
    const name = String(input.name || '').toLowerCase()
    const id = String(input.id || '').toLowerCase()
    if (/time/.test(name) || /time/.test(id)) return true
    if (input.type === 'text') {
        const value = String(input.value || '').trim()
        return /^\d{4}-\d{2}-\d{2}[ T]\d{1,2}:\d{2}/.test(value) || /^\d{2}[./]\d{2}[./]\d{4}/.test(value)
    }
    return false
}

// Делегирование событий: перехватывает фокус на любых полях даты/времени,
// даже если они появились динамически после нашей обработки.
const attachTimeDelegation = (targetDoc) => {
    if (!targetDoc || targetDoc.__sup5thTimeDelegated) return
    targetDoc.__sup5thTimeDelegated = true

    targetDoc.addEventListener('focusin', (event) => {
        const input = event.target
        if (!isTimeLikeInput(input)) return
        input.dataset.sup5thTimeEnhanced = 'true'
        const parsed = parseSupportDate(input.value)
        input.type = 'datetime-local'
        input.step = '1'
        if (parsed) input.value = toLocalValue(parsed)
    }, true)

    targetDoc.addEventListener('focusout', (event) => {
        const input = event.target
        if (!isTimeLikeInput(input) || !input.dataset.sup5thTimeEnhanced) return
        const parsed = parseSupportDate(input.value)
        input.type = 'text'
        if (parsed) input.value = formatSupportDate(parsed)
    }, true)
}

const enhanceTimePair = (targetDoc, startInput, endInput) => {
    if (enhancedTimePairs.has(endInput)) return
    enhancedTimePairs.add(endInput)

    let updatingFields = false
    let hoursInput = null
    let minutesInput = null
    let error = null

    const renderDates = () => {
        const start = parseSupportDate(startInput.value)
        const end = parseSupportDate(endInput.value)
        duration.style.display = start ? '' : 'none'
        const invalid = !start || !end || end < start
        startInput.style.border = invalid ? '1px solid #dc2626' : ''
        endInput.style.border = invalid ? '1px solid #dc2626' : ''

        if (!error) return
        if (!start) error.textContent = 'Укажите дату и время начала.'
        else if (!end) error.textContent = 'Укажите длительность или дату окончания.'
        else if (end < start) error.textContent = 'Дата окончания раньше даты начала.'
        else error.textContent = ''

        if (start && end && end >= start) {
            const totalMinutes = Math.floor((end.getTime() - start.getTime()) / 60000)
            if (hoursInput && minutesInput) {
                hoursInput.value = String(Math.floor(totalMinutes / 60))
                minutesInput.value = String(totalMinutes % 60)
            }
        }
    }

    const updateDuration = () => {
        if (!startInput || !endInput || !hoursInput || !minutesInput) return
        const parsedHours = Number(hoursInput.value || 0)
        const parsedMinutes = Number(minutesInput.value || 0)
        const invalid = !Number.isInteger(parsedHours) || !Number.isInteger(parsedMinutes) || parsedHours < 0 || parsedHours > 720 || parsedMinutes < 0 || parsedMinutes > 59
        hoursInput.setCustomValidity(invalid ? 'Укажите положительную длительность, минуты от 0 до 59.' : '')
        if (invalid) {
            error.textContent = 'Проверьте длительность: часы от 0 до 720, минуты от 0 до 59.'
            return
        }
        const totalMinutes = parsedHours * 60 + parsedMinutes
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

    ;[startInput, endInput].forEach((input) => {
        const onDateChange = () => {
            if (updatingFields) return
            renderDates()
        }
        input.addEventListener('input', onDateChange)
        input.addEventListener('change', onDateChange)
        input.addEventListener('focusout', onDateChange)
    })

    const duration = targetDoc.createElement('div')
    duration.className = 'sup5th-duration'
    const title = targetDoc.createElement('span')
    title.className = 'sup5th-duration__title'
    title.textContent = 'Время выполнения'

    hoursInput = targetDoc.createElement('input')
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

    minutesInput = targetDoc.createElement('input')
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
    error = targetDoc.createElement('span')
    error.className = 'sup5th-duration__error'

    const initialStart = parseSupportDate(startInput.value)
    const initialEnd = parseSupportDate(endInput.value)
    if (initialStart && initialEnd && initialEnd >= initialStart) {
        const totalMinutes = Math.floor((initialEnd.getTime() - initialStart.getTime()) / 60000)
        hoursInput.value = String(Math.floor(totalMinutes / 60))
        minutesInput.value = String(totalMinutes % 60)
    }

    hoursInput.addEventListener('input', updateDuration)
    minutesInput.addEventListener('input', updateDuration)
    duration.append(title, hoursInput, hoursLabel, minutesInput, minutesLabel, error)

    endInput.insertAdjacentElement('afterend', duration)
    renderDates()
}

const enhanceTimeFields = (targetDoc) => {
    ensureStyles(targetDoc)
    attachTimeDelegation(targetDoc)
    const timeInputs = [...targetDoc.querySelectorAll('input[name*="time"]')]
    timeInputs.forEach((startInput) => {
        if (!/time_start|start_time/.test(startInput.name)) return
        const endName = startInput.name.replace('time_start', 'time_end').replace('start_time', 'end_time')
        const scope = startInput.closest('tr') || startInput.form || targetDoc
        const endInput = timeInputs.find((input) => input.name === endName && scope.contains(input))
        if (endInput) enhanceTimePair(targetDoc, startInput, endInput)
    })
}

// Наблюдение за динамическим появлением полей времени внутри iframe
const observeTimeFields = (targetDoc) => {
    if (!targetDoc) return
    attachTimeDelegation(targetDoc)
    let timer
    const check = () => {
        clearTimeout(timer)
        timer = setTimeout(() => enhanceTimeFields(targetDoc), 250)
    }
    const root = targetDoc.documentElement || targetDoc
    if (!root) return
    const observer = new MutationObserver(check)
    observer.observe(root, { childList: true, subtree: true })
    check()
}

const createIframe = (id) => {
    const frame = document.createElement('iframe')
    frame.className = 'sup5th-support-modal__iframe'
    frame.src = `https://support.5th.ru/published/sta/work_log_edit.php?request_id=${encodeURIComponent(id)}`
    frame.addEventListener('load', () => {
        try {
            const frameDoc = frame.contentWindow?.document
            if (frameDoc) {
                attachTimeDelegation(frameDoc)
                enhanceTimeFields(frameDoc)
                observeTimeFields(frameDoc)
            }
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

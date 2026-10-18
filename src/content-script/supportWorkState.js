const text = element => element?.textContent?.replace(/\s+/g, ' ').trim() || ''
const disabled = button => button.disabled || button.getAttribute('aria-disabled') === 'true'

export const applyWorkDefaults = (wrapper, initialized) => {
    const projects = [...wrapper.querySelectorAll('.d5__company_projects input[name="i__project_id"]')]
    if (projects.length === 1 && !projects[0].checked) projects[0].checked = true
    const first = wrapper.querySelector('.d5__additional_work input[name="b__additional_work"]')
    if (!first || initialized.has(first)) return
    initialized.add(first)
    first.checked = true
}

const parseLogDate = value => {
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) return null
    const time = new Date(value.replace(' ', 'T')).getTime()
    return Number.isFinite(time) ? time : null
}

const readCurrentWorkStart = (wrapper, play) => {
    const user = play.getAttribute('onclick')?.match(/rq_button\(\s*1\s*,\s*\d+\s*,\s*['"]([^'"]+)['"]/)?.[1]?.toUpperCase()
    if (!user) return null
    const table = wrapper.querySelector('.listOfCompletedAndUncompletedWorks table')
    if (!table) return null
    const headers = [...table.querySelectorAll('th')].map(text)
    const owner = headers.indexOf('Исполнитель'), start = headers.indexOf('Начало'), end = headers.indexOf('Окончание')
    if ([owner, start, end].includes(-1)) return null
    const dates = [...table.rows].flatMap(row => {
        if (text(row.cells[owner]).toUpperCase() !== user || text(row.cells[end])) return []
        const time = parseLogDate(text(row.cells[start]))
        return time === null ? [] : [time]
    })
    return dates.length ? Math.max(...dates) : null
}

export const readSupportWorkState = wrapper => {
    if (!wrapper) return null
    const ticketId = text(wrapper.querySelector('.request-id b'))
    if (!/^[1-9]\d*$/.test(ticketId)) return null
    const status = text(wrapper.querySelector('.request-state b'))
    if (/^закрыт/i.test(status)) return { ticketId, state: 'inactive' }
    const play = wrapper.querySelector('#button_play'), stop = wrapper.querySelector('#button_stop')
    if (!play || !stop) return null
    const buttonTicketId = play.getAttribute('onclick')?.match(/rq_button\(\s*1\s*,\s*(\d+)\s*,/)?.[1]
    if (buttonTicketId && buttonTicketId !== ticketId) return null
    if (!disabled(play)) return { ticketId, state: 'inactive' }
    if (disabled(stop)) return null
    const startedAt = readCurrentWorkStart(wrapper, play)
    return { ticketId, state: 'active', startedAt, source: startedAt === null ? 'observed' : 'log' }
}

export const workLogText = wrapper => text(wrapper.querySelector('.listOfCompletedAndUncompletedWorks'))

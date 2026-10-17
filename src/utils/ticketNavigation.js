export const ticketDigits = value => String(value || '').replace(/\D/g, '')
export const searchTicketNumber = value => {
    const digits = ticketDigits(value)
    return /^\d{6,8}$/.test(digits) && /[1-9]/.test(digits) ? digits.replace(/^0+/, '') : ''
}
export const openTicket = async value => {
    const number = String(value).trim().replace(/^0+/, '')
    if (!/^\d+$/.test(number)) throw new Error('Введите положительный целый номер тикета')
    return chrome.tabs.create({ url: `https://support.5th.ru/published/index.php?app=ST#/requests/search/${number}/` })
}

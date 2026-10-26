// @ts-check
import { extensionApi } from '../platform/extensionApi.js'

/** @param {string | number | null | undefined} value */
export const ticketDigits = value => String(value || '').replace(/\D/g, '')
/** @param {string | number | null | undefined} value */
export const searchTicketNumber = value => {
    const digits = ticketDigits(value)
    return /^\d{6,8}$/.test(digits) && /[1-9]/.test(digits) ? digits.replace(/^0+/, '') : ''
}
/** @param {string | number} value */
export const openTicket = async value => {
    const number = String(value).trim().replace(/^0+/, '')
    if (!/^\d+$/.test(number)) throw new Error('Введите положительный целый номер тикета')
    const response = await extensionApi.runtime.sendMessage({ type: 'support:ticket:open', payload: { number } })
    if (!response?.ok) throw new Error(response?.error || 'Не удалось открыть тикет')
    return response.data
}

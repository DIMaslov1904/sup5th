import { extensionApi } from '../platform/extensionApi.js'
import {getStoredData, storageGet} from './storageRepository.js'
import {findProjectByUrl} from '../utils/projectUtils.js'
import { SUPPORT_TRACKING_KEY, activeTicketFrom, formatTicketElapsed } from '../utils/supportTimer.js'
const ICON_SIZES = [16, 32]
const PROJECT_ICONS = new Map() // size -> ImageData

const loadIconBitmap = async (size) => {
    const url = extensionApi.runtime.getURL(`src/assets/icons/icon_${size}.png`)
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Не удалось загрузить иконку ${size}`)
    return createImageBitmap(await response.blob())
}

const buildProjectIcon = async (size) => {
    const bitmap = await loadIconBitmap(size)
    const canvas = new OffscreenCanvas(size, size)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(bitmap, 0, 0, size, size)

    // Зелёный кружок в правом нижнем углу
    const padding = Math.max(1, Math.round(size * 0.05))
    const radius = Math.max(4, Math.round(size * 0.28))
    const cx = size - radius - padding
    const cy = size - radius - padding

    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    ctx.fillStyle = '#22c55e'
    ctx.fill()
    ctx.lineWidth = Math.max(1, Math.round(size * 0.07))
    ctx.strokeStyle = '#ffffff'
    ctx.stroke()

    return ctx.getImageData(0, 0, size, size)
}

const getProjectIconData = async () => {
    if (PROJECT_ICONS.size === ICON_SIZES.length) return PROJECT_ICONS
    for (const size of ICON_SIZES) {
        if (!PROJECT_ICONS.has(size)) PROJECT_ICONS.set(size, await buildProjectIcon(size))
    }
    return PROJECT_ICONS
}

const defaultIconPaths = () => Object.fromEntries(ICON_SIZES.map((size) => [size, `src/assets/icons/icon_${size}.png`]))

export const setTicketTimerBadge = async (tabId, ticket, context = {}) => {
    const elapsed = formatTicketElapsed(ticket.startedAt)
    let color = '#2563eb'
    if (Number.isInteger(tabId)) {
        const [tab, data] = await Promise.all([context.tab || extensionApi.tabs.get(tabId), context.data || getStoredData()])
        if (findProjectByUrl(data.lastSuccessfulData.projects, tab?.url)) color = '#22c55e'
    }
    await extensionApi.action.setBadgeBackgroundColor({ tabId, color })
    await extensionApi.action.setBadgeTextColor({ tabId, color: '#ffffff' })
    await extensionApi.action.setBadgeText({ tabId, text: elapsed })
    await extensionApi.action.setTitle({ tabId, title: `Тикет №${ticket.ticketId} · ${elapsed}\nОтсчёт с ${new Date(ticket.startedAt).toLocaleString('ru-RU')}` })
}

const setProjectBadge = async (tabId) => {
    try {
        const imageData = {}
        for (const [size, data] of await getProjectIconData()) imageData[size] = data
        await extensionApi.action.setIcon({ tabId, imageData })
        await extensionApi.action.setBadgeText({ tabId, text: '' })
    } catch (error) {
        // Fallback: если кастомная иконка недоступна — зелёный badge
        console.warn('[background] custom icon failed, fallback to badge', error)
        await extensionApi.action.setBadgeBackgroundColor({ tabId, color: '#22c55e' })
        await extensionApi.action.setBadgeText({ tabId, text: '✓' })
    }
}

const clearProjectBadge = async (tabId) => {
    try {
        await extensionApi.action.setIcon({ tabId, path: defaultIconPaths() })
        await extensionApi.action.setBadgeText({ tabId, text: '' })
    } catch (error) {
        console.warn('[background] reset icon failed', error)
    }
}

export const updateBadgeForTab = async (tabId, context = {}) => {
    let tab = context.tab, data = context.data
    try {
        tab ||= await extensionApi.tabs.get(tabId)
        if (!tab?.url || !/^https?:/.test(tab.url)) {
            await clearProjectBadge(tabId)
            return
        }
        data ||= await getStoredData()
        const project = findProjectByUrl(data.lastSuccessfulData.projects, tab.url)
        if (project) await setProjectBadge(tabId)
        else await clearProjectBadge(tabId)
    } catch {
        // Вкладка закрыта или недоступна — игнорируем
    } finally {
        try {
            const active = Object.hasOwn(context, 'active') ? context.active : activeTicketFrom(await storageGet(SUPPORT_TRACKING_KEY))
            if (active) await setTicketTimerBadge(tabId, active, { tab, data })
            else await extensionApi.action.setTitle({ tabId, title: extensionApi.runtime.getManifest().name })
        } catch { /* Вкладка закрыта. */ }
    }
}

export const updateActiveTabIcon = async () => {
    try {
        const [tab] = await extensionApi.tabs.query({ active: true, currentWindow: true })
        if (tab?.id) await updateBadgeForTab(tab.id)
    } catch { }
}


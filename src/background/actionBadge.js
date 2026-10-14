import {getStoredData} from './storageRepository.js'
import {findProjectByUrl} from '../utils/projectUtils.js'
const ICON_SIZES = [16, 32]
const PROJECT_ICONS = new Map() // size -> ImageData

const loadIconBitmap = async (size) => {
    const url = chrome.runtime.getURL(`src/assets/icons/icon_${size}.png`)
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

const setProjectBadge = async (tabId) => {
    try {
        const imageData = {}
        for (const [size, data] of await getProjectIconData()) imageData[size] = data
        await chrome.action.setIcon({ tabId, imageData })
        await chrome.action.setBadgeText({ tabId, text: '' })
    } catch (error) {
        // Fallback: если кастомная иконка недоступна — зелёный badge
        console.warn('[background] custom icon failed, fallback to badge', error)
        await chrome.action.setBadgeBackgroundColor({ tabId, color: '#22c55e' })
        await chrome.action.setBadgeText({ tabId, text: '✓' })
    }
}

const clearProjectBadge = async (tabId) => {
    try {
        await chrome.action.setIcon({ tabId, path: defaultIconPaths() })
        await chrome.action.setBadgeText({ tabId, text: '' })
    } catch (error) {
        console.warn('[background] reset icon failed', error)
    }
}

export const updateBadgeForTab = async (tabId) => {
    try {
        const tab = await chrome.tabs.get(tabId)
        if (!tab?.url || !/^https?:/.test(tab.url)) {
            await clearProjectBadge(tabId)
            return
        }
        const data = await getStoredData()
        const project = findProjectByUrl(data.lastSuccessfulData.projects, tab.url)
        if (project) await setProjectBadge(tabId)
        else await clearProjectBadge(tabId)
    } catch {
        // Вкладка закрыта или недоступна — игнорируем
    }
}

export const updateActiveTabIcon = async () => {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        if (tab?.id) await updateBadgeForTab(tab.id)
    } catch { }
}


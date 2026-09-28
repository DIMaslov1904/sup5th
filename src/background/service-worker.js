import { findProjectByUrl, getAdminUrl } from '../utils/projectUtils.js'

const DATA_KEY = 'projectData'
const SERVICES_KEY = 'manualServices'
const SETTINGS_KEY = 'apiSettings'
const ERRORS_KEY = 'apiErrorLog'
const AUTH_KEY = 'pendingAdminAuth'
const PROJECTS_ALARM = 'weekly-projects-refresh'
const PROJECTS_REFRESH_PERIOD_MINUTES = 7 * 24 * 60
const REQUEST_TIMEOUT = 30000
const MAX_ERROR_ENTRIES = 50

const emptyData = () => ({
    lastSuccessfulData: {
        projects: [],
        accesses: [],
        projectsUpdatedAt: null,
        accessesUpdatedAt: null,
        projectsUrl: '',
        accessesUrl: ''
    }
})

const emptySettings = () => ({ projectsUrl: '', accessUrl: '' })

const storageGet = (key, fallback) => new Promise((resolve, reject) => {
    chrome.storage.local.get([key], (result) => {
        const error = chrome.runtime.lastError
        if (error) reject(new Error(error.message))
        else resolve(result[key] ?? fallback)
    })
})

const storageSet = (key, value) => new Promise((resolve, reject) => {
    chrome.storage.local.set({ [key]: value }, () => {
        const error = chrome.runtime.lastError
        if (error) reject(new Error(error.message))
        else resolve()
    })
})

const scheduleProjectsRefresh = async (projectsUrl) => {
    await chrome.alarms.clear(PROJECTS_ALARM)
    if (!projectsUrl?.trim()) return
    await chrome.alarms.create(PROJECTS_ALARM, {
        delayInMinutes: PROJECTS_REFRESH_PERIOD_MINUTES,
        periodInMinutes: PROJECTS_REFRESH_PERIOD_MINUTES
    })
}

const restoreProjectsSchedule = async () => {
    const settings = await storageGet(SETTINGS_KEY, emptySettings())
    await scheduleProjectsRefresh(settings.projectsUrl)
}

const clearAllData = () => new Promise((resolve, reject) => {
    chrome.storage.local.clear(async () => {
        const error = chrome.runtime.lastError
        if (error) {
            reject(new Error(error.message))
            return
        }
        try {
            await chrome.alarms.clear(PROJECTS_ALARM)
            resolve()
        } catch (alarmError) {
            reject(alarmError)
        }
    })
})

const getStoredData = () => storageGet(DATA_KEY, emptyData())

// --- Индикатор "проект" на иконке расширения ---
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

const updateBadgeForTab = async (tabId) => {
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

const updateActiveTabIcon = async () => {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        if (tab?.id) await updateBadgeForTab(tab.id)
    } catch { }
}

const getUrlKey = (value) => {
    if (!value) return ''
    const candidate = String(value).trim()
    try {
        return new URL(candidate.includes('://') ? candidate : `https://${candidate}`).host
    } catch {
        return candidate.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase()
    }
}

const asText = (value) => (value == null ? '' : String(value).trim())

const normalizeProject = (item) => {
    const value = Array.isArray(item)
        ? { name: item[0], url: item[1], subdomain: item[2], manual: item[3], urlAdmin: item[4], cms: item[5], git: item[6], figma: item[7], addDocument: item[8] }
        : item || {}
    return {
        name: asText(value.name || value.title || value.project),
        url: getUrlKey(value.url || value.site || value.domain),
        subdomain: Boolean(value.subdomain),
        urlAdmin: asText(value.urlAdmin || value.adminUrl),
        cms: asText(value.cms) || 'Нет',
        manual: asText(value.manual),
        git: asText(value.git),
        figma: asText(value.figma),
        addDocument: asText(value.addDocument)
    }
}

const normalizeAccess = (item) => {
    const value = Array.isArray(item)
        ? { name: item[0], url: item[1], login: item[2], password: item[3] }
        : item || {}
    const logins = asText(value.login || value.username).split(/\r?\n/).map((entry) => entry.trim())
    const passwords = asText(value.password).split(/\r?\n/).map((entry) => entry.trim())
    const name = asText(value.name || value.title || value.project)
    const url = getUrlKey(value.url || value.site || value.domain)
    const count = Math.max(logins.length, passwords.length)

    return Array.from({ length: count }, (_, index) => ({
        name,
        url,
        login: logins[index] || '',
        password: passwords[index] || ''
    })).filter((access) => access.login || access.password)
}

const extractRows = (payload) => {
    const rows = Array.isArray(payload) ? payload : payload?.result ?? payload?.data
    if (!Array.isArray(rows)) throw new Error('Ответ API не содержит массив result')
    return rows
}

const requestRows = async (url, kind) => {
    if (!url?.trim()) throw new Error(`Не указан адрес API ${kind}`)
    let parsedUrl
    try {
        parsedUrl = new URL(url.trim())
    } catch {
        throw new Error(`Некорректный адрес API ${kind}`)
    }
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error(`API ${kind} должен использовать HTTP или HTTPS`)
    }
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)
    try {
        const response = await fetch(parsedUrl.href, {
            headers: { Accept: 'application/json' },
            signal: controller.signal
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return extractRows(await response.json())
    } catch (error) {
        if (error.name === 'AbortError') throw new Error('Превышено время ожидания API')
        throw new Error(error.message || `Ошибка запроса API ${kind}`)
    } finally {
        clearTimeout(timeoutId)
    }
}

const saveSuccessfulData = async (data, type, rows, url) => {
    const snapshot = data.lastSuccessfulData
    const nextSnapshot = { ...snapshot, [type]: rows, [`${type}UpdatedAt`]: Date.now(), [`${type}Url`]: url }
    const nextData = { lastSuccessfulData: nextSnapshot }
    await storageSet(DATA_KEY, nextData)
    return nextData
}

const logError = async (type, error) => {
    const current = await storageGet(ERRORS_KEY, [])
    const entry = { type, message: error.message || String(error), createdAt: Date.now() }
    await storageSet(ERRORS_KEY, [entry, ...current].slice(0, MAX_ERROR_ENTRIES))
}

const refreshProjects = async (url) => {
    try {
        const data = await getStoredData()
        return saveSuccessfulData(data, 'projects', (await requestRows(url, 'проектов')).map(normalizeProject), url)
    } catch (error) {
        await logError('projects', error)
        throw error
    }
}

const refreshAccesses = async (url) => {
    try {
        const data = await getStoredData()
        return saveSuccessfulData(data, 'accesses', (await requestRows(url, 'доступов')).flatMap(normalizeAccess), url)
    } catch (error) {
        await logError('accesses', error)
        throw error
    }
}

const getAuthPaths = (project, adminUrl) => ({ UMI: ['/admin/'], Bitrix: ['/bitrix/'], MODX: ['/manager/'], ABO: ['/login.php'], Tilda: ['/login/'] }[project.cms] || [new URL(adminUrl).pathname])

const startAdminAuth = async ({ url, index = 0 }) => {
    const data = await getStoredData()
    const project = data.lastSuccessfulData.projects.find((item) => item.url === url)
    const accesses = data.lastSuccessfulData.accesses.filter((item) => item.url === url)
    const access = accesses[index]
    if (!project) throw new Error('Проект не найден в локальных данных')
    if (!access) throw new Error('Для проекта не сохранён доступ с логином и паролем')
    if (!access.login || !access.password) throw new Error('У выбранного доступа отсутствует логин или пароль')
    const adminUrl = getAdminUrl(project)
    if (!adminUrl) throw new Error('Для CMS проекта не настроен адрес админки')
    const parsedAdminUrl = new URL(adminUrl)
    await storageSet(AUTH_KEY, { url: project.url, cms: project.cms, login: access.login, password: access.password, targetOrigin: parsedAdminUrl.origin, targetPaths: getAuthPaths(project, adminUrl), createdAt: Date.now() })
    await chrome.tabs.create({ url: adminUrl })
    return { started: true }
}

const copyProjectAccessText = async ({ url, index }) => {
    const data = await getStoredData()
    const project = data.lastSuccessfulData.projects.find((item) => item.url === url)
    if (!project) throw new Error('Проект не найден в локальных данных')

    const accesses = data.lastSuccessfulData.accesses.filter((item) => item.url === url)
    const access = accesses[index]
    if (!access?.login || !access?.password) throw new Error('У этого доступа отсутствуют логин или пароль')

    const adminUrl = getAdminUrl(project) || project.urlAdmin || `https://${project.url}`
    return `Доступ: ${adminUrl}\nЛогин: ${access.login}\nПароль: ${access.password}`
}

const getProjectDetails = async ({ url }) => {
    const data = await getStoredData()
    const project = data.lastSuccessfulData.projects.find((item) => item.url === url)
    if (!project) throw new Error('Проект не найден в локальных данных')

    return {
        accesses: data.lastSuccessfulData.accesses
            .filter((access) => access.url === url)
            .map(({ name, login, password }) => ({
                name,
                login,
                hasLogin: Boolean(login),
                hasPassword: Boolean(password)
            }))
    }
}

const getProjectAccessField = async ({ url, index, field }) => {
    if (!['login', 'password'].includes(field)) throw new Error('Неизвестное поле доступа')
    const data = await getStoredData()
    const access = data.lastSuccessfulData.accesses.filter((item) => item.url === url)[index]
    if (!access) throw new Error('Доступ не найден')
    if (!access[field]) throw new Error(`${field === 'login' ? 'Логин' : 'Пароль'} отсутствует`)
    return access[field]
}

const refreshAll = async ({ projectsUrl, accessUrl }) => {
    const [projectsResult, accessesResult] = await Promise.allSettled([
        requestRows(projectsUrl, 'проектов'),
        requestRows(accessUrl, 'доступов')
    ])
    const errors = []

    if (projectsResult.status === 'rejected') {
        errors.push(`Проекты: ${projectsResult.reason.message}`)
        await logError('projects', projectsResult.reason)
    }
    if (accessesResult.status === 'rejected') {
        errors.push(`Доступы: ${accessesResult.reason.message}`)
        await logError('accesses', accessesResult.reason)
    }

    if (errors.length) return { ...(await getStoredData()), refreshErrors: errors }

    const data = await getStoredData()
    const now = Date.now()
    const snapshot = {
        ...data.lastSuccessfulData,
        projects: projectsResult.value.map(normalizeProject),
        accesses: accessesResult.value.flatMap(normalizeAccess),
        projectsUpdatedAt: now,
        accessesUpdatedAt: now,
        projectsUrl,
        accessesUrl: accessUrl
    }
    const nextData = { lastSuccessfulData: snapshot }
    await storageSet(DATA_KEY, nextData)
    return nextData
}

const toPublicData = (data) => {
    const snapshot = data.lastSuccessfulData
    const projectsByUrl = new Map(snapshot.projects.filter((project) => project.url).map((project) => [project.url, project]))
    const accessCounts = new Map()

    for (const access of snapshot.accesses) {
        if (!access.url) continue
        accessCounts.set(access.url, (accessCounts.get(access.url) || 0) + 1)
        if (!projectsByUrl.has(access.url)) {
            projectsByUrl.set(access.url, { name: access.name, url: access.url, cms: 'Нет' })
        }
    }

    return {
        ...data,
        lastSuccessfulData: {
            ...snapshot,
            projects: [...projectsByUrl.values()].map((project) => ({
                ...project,
                hasAccess: accessCounts.has(project.url),
                accessCount: accessCounts.get(project.url) || 0
            })),
            accesses: snapshot.accesses.map(({ url, name, login, password }) => ({
                url,
                name,
                hasLogin: Boolean(login),
                hasPassword: Boolean(password)
            }))
        }
    }
}

const handlers = {
    'services:get': () => storageGet(SERVICES_KEY, []),
    'services:save': ({ services }) => {
        if (!Array.isArray(services)) throw new Error('Некорректный список сервисов')
        const normalized = services.map((service) => {
            const name = String(service.name || '').trim()
            const rawUrl = String(service.url || '').trim()
            if (!name || !rawUrl) throw new Error('Название и ссылка обязательны')
            const parsedUrl = new URL(rawUrl.includes('://') ? rawUrl : `https://${rawUrl}`)
            if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('Ссылка должна использовать HTTP или HTTPS')
            return {
                id: String(service.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`),
                name,
                url: parsedUrl.href,
                login: String(service.login || ''),
                password: String(service.password || '')
            }
        })
        return storageSet(SERVICES_KEY, normalized).then(() => normalized)
    },
    'data:settings:get': () => storageGet(SETTINGS_KEY, emptySettings()),
    'data:settings:set': ({ settings }) => { const nextSettings = { ...emptySettings(), ...settings }; return storageSet(SETTINGS_KEY, nextSettings).then(() => scheduleProjectsRefresh(nextSettings.projectsUrl)).then(() => nextSettings) },
    'data:projects:get': () => getStoredData().then(toPublicData),
    'data:projects:refresh': ({ url }) => refreshProjects(url).then(toPublicData),
    'data:accesses:refresh': ({ url }) => refreshAccesses(url).then(toPublicData),
    'data:all:refresh': (payload) => refreshAll(payload).then(toPublicData),
    'data:errors:get': () => storageGet(ERRORS_KEY, []),
    'data:clear': () => clearAllData().then(() => ({ cleared: true })),
    'auth:start': startAdminAuth,
    'project:copyAccess': copyProjectAccessText,
    'project:details': getProjectDetails,
    'project:accessField': getProjectAccessField
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const handler = handlers[message?.type]
    if (!handler) return false
    Promise.resolve().then(() => handler(message.payload || {}))
        .then((data) => {
            if (message?.type?.startsWith('data:')) updateActiveTabIcon()
            sendResponse({ ok: true, data })
        })
        .catch((error) => { console.error(`[background] ${message.type}`, error); sendResponse({ ok: false, error: error.message }) })
    return true
})

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== PROJECTS_ALARM) return
    storageGet(SETTINGS_KEY, emptySettings()).then((settings) => refreshProjects(settings.projectsUrl)).catch((error) => console.error('[background] weekly projects refresh', error))
})

chrome.runtime.onInstalled.addListener(() => restoreProjectsSchedule().catch((error) => console.error('[background] restore schedule', error)))
chrome.runtime.onStartup.addListener(() => restoreProjectsSchedule().catch((error) => console.error('[background] restore schedule', error)))

// Обновление индикатора при переключении вкладок
chrome.tabs.onActivated.addListener(({ tabId }) => updateBadgeForTab(tabId))
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'complete') updateBadgeForTab(tabId)
})

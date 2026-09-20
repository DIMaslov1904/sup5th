const DATA_KEY = 'projectData'
const SETTINGS_KEY = 'apiSettings'
const ERRORS_KEY = 'apiErrorLog'
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

const getStoredData = async () => {
    const stored = await storageGet(DATA_KEY, emptyData())
    if (stored.lastSuccessfulData) return stored

    return {
        lastSuccessfulData: {
            projects: stored.projects || [],
            accesses: stored.accesses || [],
            projectsUpdatedAt: stored.updatedAt || null,
            accessesUpdatedAt: stored.updatedAt || null,
            projectsUrl: '',
            accessesUrl: ''
        }
    }
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
        addDocument: asText(value.addDocument),
        login: asText(value.login),
        password: asText(value.password)
    }
}

const normalizeAccess = (item) => {
    const value = Array.isArray(item)
        ? { name: item[0], url: item[1], login: item[2], password: item[3] }
        : item || {}

    return {
        name: asText(value.name || value.title || value.project),
        url: getUrlKey(value.url || value.site || value.domain),
        login: asText(value.login || value.username),
        password: asText(value.password)
    }
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

const mergeProjectsAndAccesses = ({ projects, accesses }) => {
    const merged = new Map(projects.filter((item) => item.url).map((item) => [item.url, item]))
    for (const access of accesses) {
        if (!access.url) continue
        const project = merged.get(access.url)
        merged.set(access.url, {
            ...(project || { name: access.name }),
            login: access.login,
            password: access.password
        })
    }
    return [...merged.values()]
}

const saveSuccessfulData = async (data, type, rows, url) => {
    const snapshot = data.lastSuccessfulData
    const nextSnapshot = {
        ...snapshot,
        [type]: rows,
        [`${type}UpdatedAt`]: Date.now(),
        [`${type}Url`]: url
    }
    nextSnapshot.projects = mergeProjectsAndAccesses(nextSnapshot)
    await storageSet(DATA_KEY, { lastSuccessfulData: nextSnapshot })
    return { lastSuccessfulData: nextSnapshot }
}

const logError = async (type, error) => {
    const current = await storageGet(ERRORS_KEY, [])
    const entry = { type, message: error.message || String(error), createdAt: Date.now() }
    await storageSet(ERRORS_KEY, [entry, ...current].slice(0, MAX_ERROR_ENTRIES))
}

const refreshProjects = async (url) => {
    try {
        const data = await getStoredData()
        const rows = (await requestRows(url, 'проектов')).map(normalizeProject)
        return saveSuccessfulData(data, 'projects', rows, url)
    } catch (error) {
        await logError('projects', error)
        throw error
    }
}

const refreshAccesses = async (url) => {
    try {
        const data = await getStoredData()
        const rows = (await requestRows(url, 'доступов')).map(normalizeAccess)
        return saveSuccessfulData(data, 'accesses', rows, url)
    } catch (error) {
        await logError('accesses', error)
        throw error
    }
}

const refreshAll = async ({ projectsUrl, accessUrl }) => {
    const errors = []
    try {
        await refreshProjects(projectsUrl)
    } catch (error) {
        errors.push(`Проекты: ${error.message}`)
    }
    try {
        await refreshAccesses(accessUrl)
    } catch (error) {
        errors.push(`Доступы: ${error.message}`)
    }
    return { ...(await getStoredData()), refreshErrors: errors }
}

const toPublicData = (data) => ({
    ...data,
    lastSuccessfulData: {
        ...data.lastSuccessfulData,
        projects: data.lastSuccessfulData.projects.map(({ password, ...project }) => project),
        accesses: data.lastSuccessfulData.accesses.map(({ password, ...access }) => access)
    }
})

const handlers = {
    'data:settings:get': () => storageGet(SETTINGS_KEY, emptySettings()),
    'data:settings:set': ({ settings }) => {
        const nextSettings = { ...emptySettings(), ...settings }
        return storageSet(SETTINGS_KEY, nextSettings)
            .then(() => scheduleProjectsRefresh(nextSettings.projectsUrl))
            .then(() => nextSettings)
    },
    'data:projects:get': () => getStoredData().then(toPublicData),
    'data:projects:refresh': ({ url }) => refreshProjects(url).then(toPublicData),
    'data:accesses:refresh': ({ url }) => refreshAccesses(url).then(toPublicData),
    'data:all:refresh': (payload) => refreshAll(payload).then(toPublicData),
    'data:errors:get': () => storageGet(ERRORS_KEY, []),
    'data:clear': () => clearAllData().then(() => ({ cleared: true }))
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const handler = handlers[message?.type]
    if (!handler) return false

    Promise.resolve(handler(message.payload || {}))
        .then((data) => sendResponse({ ok: true, data }))
        .catch((error) => {
            console.error(`[background] ${message.type}`, error)
            sendResponse({ ok: false, error: error.message })
        })
    return true
})

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== PROJECTS_ALARM) return

    storageGet(SETTINGS_KEY, emptySettings())
        .then((settings) => refreshProjects(settings.projectsUrl))
        .catch((error) => console.error('[background] weekly projects refresh', error))
})

chrome.runtime.onInstalled.addListener(() => {
    restoreProjectsSchedule().catch((error) => console.error('[background] restore schedule', error))
})

chrome.runtime.onStartup.addListener(() => {
    restoreProjectsSchedule().catch((error) => console.error('[background] restore schedule', error))
})

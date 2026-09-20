const STORAGE_KEY = 'projectData'
const SETTINGS_KEY = 'apiSettings'
const REQUEST_TIMEOUT = 30000

const emptyData = () => ({
    projects: [],
    accesses: [],
    updatedAt: null
})

const emptySettings = () => ({
    projectsUrl: '',
    accessUrl: ''
})

const storageGet = (key, fallback) => new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => resolve(result[key] ?? fallback))
})

const storageSet = (key, value) => new Promise((resolve, reject) => {
    chrome.storage.local.set({ [key]: value }, () => {
        const error = chrome.runtime.lastError
        if (error) reject(new Error(error.message))
        else resolve()
    })
})

export const loadApiSettings = () => storageGet(SETTINGS_KEY, emptySettings())

export const saveApiSettings = (settings) =>
    storageSet(SETTINGS_KEY, { ...emptySettings(), ...settings })

export const loadProjectData = () => storageGet(STORAGE_KEY, emptyData())

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
        ? {
            name: item[0],
            url: item[1],
            subdomain: item[2],
            manual: item[3],
            urlAdmin: item[4],
            cms: item[5],
            git: item[6],
            figma: item[7],
            addDocument: item[8]
        }
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
    if (!url.trim()) throw new Error(`Не указан адрес API ${kind}`)

    let parsedUrl
    try {
        parsedUrl = new URL(url)
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
        if (error.name === 'AbortError') throw new Error('превышено время ожидания')
        throw new Error(error.message || `ошибка запроса API ${kind}`)
    } finally {
        clearTimeout(timeoutId)
    }
}

const mergeData = (data) => {
    const projects = new Map(data.projects.filter((item) => item.url).map((item) => [item.url, item]))
    for (const access of data.accesses) {
        if (!access.url) continue
        const project = projects.get(access.url)
        projects.set(access.url, {
            ...(project || { name: access.name }),
            login: access.login,
            password: access.password
        })
    }
    return [...projects.values()]
}

const saveData = async (data) => {
    const nextData = {
        ...data,
        projects: mergeData(data),
        updatedAt: Date.now()
    }
    await storageSet(STORAGE_KEY, nextData)
    return nextData
}

export const refreshProjects = async (url) => {
    const data = await loadProjectData()
    data.projects = (await requestRows(url, 'проектов')).map(normalizeProject)
    return saveData(data)
}

export const refreshAccesses = async (url) => {
    const data = await loadProjectData()
    data.accesses = (await requestRows(url, 'доступов')).map(normalizeAccess)
    return saveData(data)
}

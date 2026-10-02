import { findProjectByUrl, getAdminUrl } from '../utils/projectUtils.js'
import {
    base64ToBytes,
    bytesToBase64,
    derivePinWrappingKey,
    importAesKey,
    openBytes,
    openJson,
    randomBytes,
    sealBytes,
    sealJson
} from './credentialCrypto.js'

const DATA_KEY = 'projectData'
const SERVICES_KEY = 'manualServices'
const SETTINGS_KEY = 'apiSettings'
const ERRORS_KEY = 'apiErrorLog'
const AUTH_KEY = 'pendingAdminAuth'
const SECURITY_KEY = 'credentialSecurity'
const VAULT_KEY = 'credentialVault'
const UNLOCKED_KEY = 'unlockedCredentialVaultKey'
const PENDING_AUTH_SESSIONS_KEY = 'pendingAdminAuthSessions'
const PIN_KDF_ITERATIONS = 600000
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

const storageSetMany = (values) => new Promise((resolve, reject) => {
    chrome.storage.local.set(values, () => {
        const error = chrome.runtime.lastError
        if (error) reject(new Error(error.message))
        else resolve()
    })
})

const sessionGet = async (key, fallback = null) => {
    if (!chrome.storage.session) throw new Error('Session storage недоступен в этой версии Chrome')
    return new Promise((resolve, reject) => {
        chrome.storage.session.get([key], (result) => {
            const error = chrome.runtime.lastError
            if (error) reject(new Error(error.message))
            else resolve(result[key] ?? fallback)
        })
    })
}

const sessionSet = async (key, value) => new Promise((resolve, reject) => {
    chrome.storage.session.set({ [key]: value }, () => {
        const error = chrome.runtime.lastError
        if (error) reject(new Error(error.message))
        else resolve()
    })
})

const sessionRemove = async (key) => new Promise((resolve, reject) => {
    chrome.storage.session.remove(key, () => {
        const error = chrome.runtime.lastError
        if (error) reject(new Error(error.message))
        else resolve()
    })
})

const getSecurityConfig = () => storageGet(SECURITY_KEY, null)

// Ключ разблокировки живёт только в chrome.storage.session — он очищается
// при завершении сессии браузера, поэтому хранилище автоматически блокируется
// при закрытии браузера (без TTL).
const getUnlockedKey = async ({ required = true } = {}) => {
    const config = await getSecurityConfig()
    if (!config?.enabled) return null
    const session = await sessionGet(UNLOCKED_KEY)
    if (!session?.key) {
        if (required) throw new Error('Хранилище заблокировано. Разблокируйте его в настройках.')
        return null
    }
    return importAesKey(base64ToBytes(session.key))
}

const storeUnlockedKey = async (rawKey) => sessionSet(UNLOCKED_KEY, {
    key: bytesToBase64(rawKey)
})

const readCredentialVault = async (key) => {
    const encrypted = await storageGet(VAULT_KEY, null)
    if (!encrypted) throw new Error('Зашифрованное хранилище не найдено')
    return openJson(encrypted, key)
}

const encryptCredentialVault = (vault, key) => sealJson(vault, key)

const publicAccess = (access) => ({
    url: access.url,
    name: access.name,
    hasLogin: Boolean(access.login || access.hasLogin),
    hasPassword: Boolean(access.password || access.hasPassword),
    hasFtp: Boolean(access.ftp?.url || access.hasFtp),
    ftpUrl: access.ftp?.url || access.ftpUrl || '',
    ftpHasLogin: Boolean(access.ftp?.login || access.ftpHasLogin),
    ftpHasPassword: Boolean(access.ftp?.password || access.ftpHasPassword)
})

const enableProtectedVault = async (mode, wrappingKey, options = {}) => {
    if (await getSecurityConfig()) throw new Error('Защита уже включена')

    const { rawVaultKey: suppliedVaultKey, ...configOptions } = options

    const data = await getStoredData()
    const services = await storageGet(SERVICES_KEY, [])
    const vault = {
        accesses: data.lastSuccessfulData.accesses.map((access) => ({ ...access })),
        services: services.map(({ id, login, password }) => ({ id, login: login || '', password: password || '' }))
    }
    const rawVaultKey = suppliedVaultKey || randomBytes(32)
    const vaultKey = await importAesKey(rawVaultKey)
    const wrappedKey = wrappingKey ? await sealBytes(rawVaultKey, wrappingKey) : null
    const encryptedVault = await sealJson(vault, vaultKey)
    const safeData = {
        ...data,
        lastSuccessfulData: {
            ...data.lastSuccessfulData,
            accesses: data.lastSuccessfulData.accesses.map(publicAccess)
        }
    }
    const safeServices = services.map(({ login, password, ...service }) => ({
        ...service,
        hasLogin: Boolean(login),
        hasPassword: Boolean(password)
    }))
    const config = { enabled: true, mode, ...(wrappedKey ? { wrappedKey } : {}), ...configOptions, createdAt: Date.now() }

    await new Promise((resolve, reject) => chrome.storage.local.remove(AUTH_KEY, () => {
        const error = chrome.runtime.lastError
        if (error) reject(new Error(error.message))
        else resolve()
    }))
    await sessionRemove(PENDING_AUTH_SESSIONS_KEY)
    await storageSetMany({
        [DATA_KEY]: safeData,
        [SERVICES_KEY]: safeServices,
        [SECURITY_KEY]: config,
        [VAULT_KEY]: encryptedVault
    })
    await storeUnlockedKey(rawVaultKey)
    return { enabled: true, mode, unlocked: true }
}

const unlockWithWrappingKey = async (config, wrappingKey) => {
    try {
        const rawKey = await openBytes(config.wrappedKey, wrappingKey)
        return unlockWithVaultKey(config, rawKey)
    } catch {
        throw new Error('Неверный PIN или хранилище повреждено')
    }
}

const unlockWithVaultKey = async (config, rawKey) => {
    if (rawKey.length !== 32) throw new Error('Получен некорректный ключ хранилища')
    const vaultKey = await importAesKey(rawKey)
    await readCredentialVault(vaultKey)
    await storeUnlockedKey(rawKey)
    return { enabled: true, mode: config.mode, unlocked: true }
}

const getCredentialVaultIfUnlocked = async () => {
    const key = await getUnlockedKey({ required: false })
    return key ? readCredentialVault(key) : null
}

const getSecurityStatus = async ({ helloAvailable = false, prfSupported = false } = {}) => {
    const config = await getSecurityConfig()
    const base = { helloAvailable: Boolean(helloAvailable), prfSupported: Boolean(prfSupported) }
    if (!config?.enabled) return { enabled: false, mode: 'off', unlocked: true, ...base }
    const session = await sessionGet(UNLOCKED_KEY)
    const unlocked = Boolean(session?.key)
    return {
        enabled: true,
        mode: config.mode,
        unlocked,
        ...base,
        credentialId: config.credentialId || '',
        prfSalt: config.prfSalt || '',
        wrappedKey: config.wrappedKey || null
    }
}

const enablePinProtection = async ({ pin }) => {
    if (typeof pin !== 'string' || !/^\d{8,12}$/.test(pin)) {
        throw new Error('PIN должен содержать от 8 до 12 цифр')
    }
    const salt = randomBytes(16)
    const iterations = PIN_KDF_ITERATIONS
    const wrappingKey = await derivePinWrappingKey(pin, salt, iterations)
    return enableProtectedVault('pin', wrappingKey, { salt: bytesToBase64(salt), iterations })
}

const enableWindowsHelloProtection = async ({ rawVaultKey, credentialId, prfSalt, wrappedKey } = {}) => {
    if (await getSecurityConfig()) throw new Error('Защита уже включена')
    if (typeof rawVaultKey !== 'string' || base64ToBytes(rawVaultKey).length !== 32) {
        throw new Error('Отсутствует корректный ключ хранилища от Windows Hello')
    }
    if (typeof credentialId !== 'string' || !credentialId) throw new Error('Отсутствует идентификатор пасскея Windows Hello')
    if (typeof prfSalt !== 'string' || base64ToBytes(prfSalt).length < 16) {
        throw new Error('Параметры Windows Hello повреждены')
    }
    if (!wrappedKey?.iv || !wrappedKey?.ciphertext) throw new Error('Отсутствует обёрнутый ключ Windows Hello')
    return enableProtectedVault('hello', null, {
        rawVaultKey: base64ToBytes(rawVaultKey),
        credentialId,
        prfSalt,
        wrappedKey
    })
}

const unlockWithPin = async ({ pin }) => {
    const config = await getSecurityConfig()
    if (!config?.enabled || config.mode !== 'pin') throw new Error('PIN-защита не настроена')
    if (typeof pin !== 'string' || !/^\d{8,12}$/.test(pin)) throw new Error('Введите PIN от 8 до 12 цифр')
    if (!Number.isInteger(config.iterations) || config.iterations < 100000 || config.iterations > 2000000 ||
        base64ToBytes(config.salt || '').length !== 16) {
        throw new Error('Параметры PIN-хранилища повреждены')
    }
    const wrappingKey = await derivePinWrappingKey(pin, base64ToBytes(config.salt), config.iterations)
    return unlockWithWrappingKey(config, wrappingKey)
}

const unlockWithWindowsHelloKey = async ({ key }) => {
    const config = await getSecurityConfig()
    if (!config?.enabled || config.mode !== 'hello') throw new Error('Windows Hello-защита не настроена')
    if (typeof key !== 'string') throw new Error('Windows Hello не вернул ключ vault')
    return unlockWithVaultKey(config, base64ToBytes(key))
}

const lockCredentialVault = async () => {
    await sessionRemove(UNLOCKED_KEY)
    return getSecurityStatus()
}

const disableCredentialProtection = async () => {
    const config = await getSecurityConfig()
    if (!config?.enabled) return { enabled: false, mode: 'off', unlocked: true }
    const key = await getUnlockedKey()
    const vault = await readCredentialVault(key)
    const data = await getStoredData()
    const services = await storageGet(SERVICES_KEY, [])
    const accessIndexes = new Map()
    const restoredAccesses = data.lastSuccessfulData.accesses.map((access) => {
        const index = accessIndexes.get(access.url) || 0
        accessIndexes.set(access.url, index + 1)
        const secret = vault.accesses.filter((entry) => entry.url === access.url)[index]
        if (!secret) throw new Error('Не удалось сопоставить запись с vault. Защита не отключена, данные сохранены.')
        const { hasLogin, hasPassword, hasFtp, ftpUrl, ftpHasLogin, ftpHasPassword, ...metadata } = access
        return {
            ...metadata,
            login: secret?.login || '',
            password: secret?.password || '',
            ...(secret?.ftp ? { ftp: secret.ftp } : {})
        }
    })
    const restoredServices = services.map((service) => {
        const secret = vault.services.find((entry) => entry.id === service.id)
        if (!secret) throw new Error('Не удалось сопоставить сервис с vault. Защита не отключена, данные сохранены.')
        const { hasLogin, hasPassword, ...metadata } = service
        return { ...metadata, login: secret.login || '', password: secret.password || '' }
    })
    const restoredData = {
        ...data,
        lastSuccessfulData: { ...data.lastSuccessfulData, accesses: restoredAccesses }
    }
    await sessionRemove(UNLOCKED_KEY)
    await storageSetMany({
        [DATA_KEY]: restoredData,
        [SERVICES_KEY]: restoredServices,
        [SECURITY_KEY]: null
    })
    chrome.storage.local.remove([SECURITY_KEY, VAULT_KEY], () => {
        if (chrome.runtime.lastError) console.warn('[background] stale vault cleanup', chrome.runtime.lastError.message)
    })
    return { enabled: false, mode: 'off', unlocked: true }
}

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

const clearAllData = async () => {
    await new Promise((resolve, reject) => chrome.storage.local.clear(() => {
        const error = chrome.runtime.lastError
        if (error) reject(new Error(error.message))
        else resolve()
    }))
    await chrome.alarms.clear(PROJECTS_ALARM)
    await sessionRemove(UNLOCKED_KEY)
    await sessionRemove(PENDING_AUTH_SESSIONS_KEY)
}

const getStoredData = () => storageGet(DATA_KEY, emptyData())

// --- Универсальный fetch для SEO и внешних проверок (обходит CSP страницы) ---
const fetchExternal = async ({ url, method = 'GET', timeout = 20000 }) => {
    let parsedUrl
    try {
        parsedUrl = new URL(url)
    } catch {
        return { ok: false, status: 0, url: '', headers: {}, text: '' }
    }
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) return { ok: false, status: 0, url: '', headers: {}, text: '' }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)
    const startedAt = performance.now()
    try {
        const response = await fetch(parsedUrl.href, {
            method,
            credentials: 'omit',
            redirect: 'follow',
            signal: controller.signal
        })
        const text = await response.text()
        return {
            ok: response.ok,
            status: response.status,
            url: response.url,
            headers: Object.fromEntries(response.headers.entries()),
            text: text.slice(0, 200000),
            ttfb: Math.round(performance.now() - startedAt)
        }
    } catch (error) {
        if (error.name === 'AbortError') return { ok: false, status: 0, url: '', headers: {}, text: '', ttfb: null }
        return { ok: false, status: 0, url: '', headers: {}, text: '', ttfb: null }
    } finally {
        clearTimeout(timeoutId)
    }
}

// --- Контекстное меню ---
if (chrome.contextMenus) {
    const ensureContextMenus = () => {
        chrome.contextMenus.removeAll(() => {
            chrome.contextMenus.create({
                id: 'sup5th-admin',
                title: 'Открыть админку проекта',
                contexts: ['page', 'link']
            })
            chrome.contextMenus.create({
                id: 'sup5th-copy-access',
                title: 'Скопировать доступ к проекту',
                contexts: ['page', 'link']
            })
        })
    }
    chrome.runtime.onInstalled.addListener(() => {
        try {
            ensureContextMenus()
        } catch (error) {
            console.warn('[background] context menus init', error)
        }
    })
    chrome.runtime.onStartup.addListener(() => {
        try {
            ensureContextMenus()
        } catch (error) {
            console.warn('[background] context menus startup', error)
        }
    })

    chrome.contextMenus.onClicked.addListener(async (info, tab) => {
        try {
            const targetUrl = info.linkUrl || info.pageUrl || tab?.url
            if (!targetUrl || !/^https?:/.test(targetUrl)) return
            const data = await getStoredData()
            const project = findProjectByUrl(data.lastSuccessfulData.projects, targetUrl)
            if (!project) return

            if (info.menuItemId === 'sup5th-admin') {
                const adminUrl = getAdminUrl(project)
                if (adminUrl) await chrome.tabs.create({ url: adminUrl })
                return
            }

            if (info.menuItemId === 'sup5th-copy-access') {
                const accesses = await getProjectAccessRecords(data, project.url)
                const access = accesses[0]
                if (!access?.login || !access?.password) return
                const adminUrl = getAdminUrl(project) || project.urlAdmin || `https://${project.url}`
                const text = `Доступ: ${adminUrl}\nЛогин: ${access.login}\nПароль: ${access.password}`
                if (tab?.id != null) {
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        func: (value) => {
                            const textarea = document.createElement('textarea')
                            textarea.value = value
                            textarea.style.position = 'fixed'
                            textarea.style.opacity = '0'
                            document.body.appendChild(textarea)
                            textarea.select()
                            const ok = document.execCommand('copy')
                            textarea.remove()
                            return ok
                        },
                        args: [text]
                    })
                }
            }
        } catch (error) {
            console.error('[background] context menu', error)
        }
    })
}

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
    const ftpValue = value.ftp && typeof value.ftp === 'object' ? value.ftp : {}
    const ftp = {
        url: asText(ftpValue.url || value.ftpUrl),
        login: asText(ftpValue.login || value.ftpLogin),
        password: asText(ftpValue.password || value.ftpPassword)
    }
    const count = Math.max(logins.length, passwords.length)

    return Array.from({ length: count }, (_, index) => ({
        name,
        url,
        login: logins[index] || '',
        password: passwords[index] || '',
        ...(ftp.url || ftp.login || ftp.password ? { ftp } : {})
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
    let values = rows
    let encryptedVault = null
    if (type === 'accesses' && (await getSecurityConfig())?.enabled) {
        const key = await getUnlockedKey()
        const vault = await readCredentialVault(key)
        vault.accesses = rows
        encryptedVault = await encryptCredentialVault(vault, key)
        values = rows.map(publicAccess)
    }
    const nextSnapshot = { ...snapshot, [type]: values, [`${type}UpdatedAt`]: Date.now(), [`${type}Url`]: url }
    const nextData = { lastSuccessfulData: nextSnapshot }
    await storageSetMany({
        [DATA_KEY]: nextData,
        ...(encryptedVault ? { [VAULT_KEY]: encryptedVault } : {})
    })
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

const getProjectAccessRecords = async (data, url, requireUnlocked = true) => {
    if (!(await getSecurityConfig())?.enabled) return data.lastSuccessfulData.accesses.filter((access) => access.url === url)
    const key = await getUnlockedKey({ required: requireUnlocked })
    if (!key) return data.lastSuccessfulData.accesses.filter((access) => access.url === url)
    const vault = await readCredentialVault(key)
    return vault.accesses.filter((access) => access.url === url)
}

const getAuthPaths = (project, adminUrl) => ({ UMI: ['/admin/'], Bitrix: ['/bitrix/'], MODX: ['/manager/'], ABO: ['/login.php'], Tilda: ['/login/'] }[project.cms] || [new URL(adminUrl).pathname])

const startAdminAuth = async ({ url, index = 0 }) => {
    const data = await getStoredData()
    const project = data.lastSuccessfulData.projects.find((item) => item.url === url)
    const accesses = await getProjectAccessRecords(data, url)
    const access = accesses[index]
    if (!project) throw new Error('Проект не найден в локальных данных')
    if (!access) throw new Error('Для проекта не сохранён доступ с логином и паролем')
    if (!access.login || !access.password) throw new Error('У выбранного доступа отсутствует логин или пароль')
    const adminUrl = getAdminUrl(project)
    if (!adminUrl) throw new Error('Для CMS проекта не настроен адрес админки')
    const parsedAdminUrl = new URL(adminUrl)
    const tab = await chrome.tabs.create({ url: 'about:blank' })
    const sessions = await sessionGet(PENDING_AUTH_SESSIONS_KEY, {})
    sessions[String(tab.id)] = {
        url: project.url,
        cms: project.cms,
        login: access.login,
        password: access.password,
        targetOrigin: parsedAdminUrl.origin,
        targetPaths: getAuthPaths(project, adminUrl),
        createdAt: Date.now(),
        expiresAt: Date.now() + 5 * 60 * 1000
    }
    try {
        await sessionSet(PENDING_AUTH_SESSIONS_KEY, sessions)
        await chrome.tabs.update(tab.id, { url: adminUrl })
    } catch (error) {
        delete sessions[String(tab.id)]
        await sessionSet(PENDING_AUTH_SESSIONS_KEY, sessions)
        throw error
    }
    return { started: true }
}

const consumePendingAdminAuth = async (sender) => {
    const tabId = sender?.tab?.id
    if (!Number.isInteger(tabId) || sender.frameId !== 0 || !sender.url) return null
    let senderUrl
    try {
        senderUrl = new URL(sender.url)
    } catch {
        return null
    }
    const sessions = await sessionGet(PENDING_AUTH_SESSIONS_KEY, {})
    const key = String(tabId)
    const auth = sessions[key]
    if (!auth) return null
    delete sessions[key]
    await sessionSet(PENDING_AUTH_SESSIONS_KEY, sessions)
    if (auth.expiresAt <= Date.now() || senderUrl.origin !== auth.targetOrigin ||
        !auth.targetPaths.some((path) => senderUrl.pathname.startsWith(path))) return null
    return { login: auth.login, password: auth.password, cms: auth.cms, createdAt: auth.createdAt }
}

const copyProjectAccessText = async ({ url, index }) => {
    const data = await getStoredData()
    const project = data.lastSuccessfulData.projects.find((item) => item.url === url)
    if (!project) throw new Error('Проект не найден в локальных данных')

    const accesses = await getProjectAccessRecords(data, url)
    const access = accesses[index]
    if (!access?.login || !access?.password) throw new Error('У этого доступа отсутствуют логин или пароль')

    const adminUrl = getAdminUrl(project) || project.urlAdmin || `https://${project.url}`
    return `Доступ: ${adminUrl}\nЛогин: ${access.login}\nПароль: ${access.password}`
}

const getProjectDetails = async ({ url }) => {
    const data = await getStoredData()
    const project = data.lastSuccessfulData.projects.find((item) => item.url === url)
    if (!project) throw new Error('Проект не найден в локальных данных')

    const accesses = await getProjectAccessRecords(data, url, false)
    const protectedMode = Boolean((await getSecurityConfig())?.enabled)
    const key = protectedMode ? await getUnlockedKey({ required: false }) : null
    const vaultAccesses = key ? accesses : null
    const metadataAccesses = data.lastSuccessfulData.accesses.filter((access) => access.url === url)
    const displayAccesses = vaultAccesses || metadataAccesses

    return {
        locked: protectedMode && !key,
        accesses: displayAccesses.map(({ name, login, password, ftp, hasLogin, hasPassword, hasFtp, ftpUrl, ftpHasLogin, ftpHasPassword }) => ({
            name,
            login: key || !protectedMode ? login || '' : '',
            hasLogin: Boolean(login || hasLogin),
            hasPassword: Boolean(password || hasPassword),
            hasFtp: Boolean(ftp?.url || hasFtp),
            ftpUrl: ftp?.url || ftpUrl || '',
            ftpHasLogin: Boolean(ftp?.login || ftpHasLogin),
            ftpHasPassword: Boolean(ftp?.password || ftpHasPassword),
            ftpLogin: key || !protectedMode ? ftp?.login || '' : ''
        }))
    }
}

const getProjectAccessField = async ({ url, index, field }) => {
    if (!['login', 'password', 'ftpLogin', 'ftpPassword'].includes(field)) throw new Error('Неизвестное поле доступа')
    const data = await getStoredData()
    const access = (await getProjectAccessRecords(data, url))[index]
    if (!access) throw new Error('Доступ не найден')
    if (field === 'ftpLogin' || field === 'ftpPassword') {
        const ftpValue = field === 'ftpLogin' ? access.ftp?.login : access.ftp?.password
        if (!ftpValue) throw new Error(`${field === 'ftpLogin' ? 'FTP логин' : 'FTP пароль'} отсутствует`)
        return ftpValue
    }
    if (!access[field]) throw new Error(`${field === 'login' ? 'Логин' : 'Пароль'} отсутствует`)
    return access[field]
}

const getServices = async () => {
    const services = await storageGet(SERVICES_KEY, [])
    if (!(await getSecurityConfig())?.enabled) return services
    const vault = await getCredentialVaultIfUnlocked()
    if (!vault) return services
    const secretsById = new Map(vault.services.map((service) => [service.id, service]))
    return services.map((service) => ({ ...service, ...secretsById.get(service.id) }))
}

const saveServices = async (payload) => {
    // Роутер передаёт message.payload ({ services: [...] }), но допускаем и прямой массив
    const services = Array.isArray(payload) ? payload : payload?.services
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
    const security = await getSecurityConfig()
    if (!security?.enabled) {
        await storageSet(SERVICES_KEY, normalized)
        return normalized
    }
    const key = await getUnlockedKey()
    const vault = await readCredentialVault(key)
    vault.services = normalized.map(({ id, login, password }) => ({ id, login, password }))
    const safeServices = normalized.map(({ login, password, ...service }) => ({
        ...service,
        hasLogin: Boolean(login),
        hasPassword: Boolean(password)
    }))
    const encryptedVault = await encryptCredentialVault(vault, key)
    await storageSetMany({ [VAULT_KEY]: encryptedVault, [SERVICES_KEY]: safeServices })
    return normalized
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
    const securityConfig = await getSecurityConfig()
    const protectedMode = Boolean(securityConfig?.enabled)
    const key = protectedMode ? await getUnlockedKey({ required: false }) : null
    const updateAccesses = !protectedMode || Boolean(key)
    let accesses = updateAccesses ? accessesResult.value.flatMap(normalizeAccess) : data.lastSuccessfulData.accesses
    let encryptedVault = null
    if (protectedMode && key) {
        const vault = await readCredentialVault(key)
        vault.accesses = accesses
        encryptedVault = await encryptCredentialVault(vault, key)
        accesses = accesses.map(publicAccess)
    }
    if (protectedMode && !key) errors.push('Доступы: обновление пропущено, хранилище заблокировано')
    const now = Date.now()
    const snapshot = {
        ...data.lastSuccessfulData,
        projects: projectsResult.value.map(normalizeProject),
        ...(updateAccesses ? { accesses } : {}),
        projectsUpdatedAt: now,
        projectsUrl,
        ...(updateAccesses ? { accessesUpdatedAt: now, accessesUrl: accessUrl } : {})
    }
    const nextData = { lastSuccessfulData: snapshot }
    await storageSetMany({
        [DATA_KEY]: nextData,
        ...(encryptedVault ? { [VAULT_KEY]: encryptedVault } : {})
    })
    return errors.length ? { ...nextData, refreshErrors: errors } : nextData
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
            accesses: snapshot.accesses.map(publicAccess)
        }
    }
}

const handlers = {
    'services:get': getServices,
    'services:save': saveServices,
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
    'project:accessField': getProjectAccessField,
    'security:status': getSecurityStatus,
    'security:enablePin': enablePinProtection,
    'security:enableHello': enableWindowsHelloProtection,
    'security:unlockPin': unlockWithPin,
    'security:unlockHelloKey': unlockWithWindowsHelloKey,
    'security:lock': lockCredentialVault,
    'security:disable': disableCredentialProtection,
    'auth:consume': (_payload, sender) => consumePendingAdminAuth(sender),
    'seo:fetch': fetchExternal
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const handler = handlers[message?.type]
    if (!handler) return false
    const internalOnly = message.type.startsWith('security:')
    if (internalOnly && (!sender?.url?.startsWith(chrome.runtime.getURL('')) || sender.id !== chrome.runtime.id)) {
        sendResponse({ ok: false, error: 'Операция доступна только в интерфейсе расширения' })
        return false
    }
    Promise.resolve().then(() => handler(message.payload || {}, sender))
        .then((data) => {
            if (message?.type?.startsWith('data:')) updateActiveTabIcon()
            sendResponse({ ok: true, data })
        })
        .catch((error) => { console.error(`[background] ${message.type}`, error); sendResponse({ ok: false, error: error.message }) })
    return true
})

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== PROJECTS_ALARM) return
    storageGet(SETTINGS_KEY, emptySettings())
        .then((settings) => refreshAll({ projectsUrl: settings.projectsUrl, accessUrl: settings.accessUrl }))
        .catch((error) => console.error('[background] weekly refresh', error))
})

const clearLegacyPendingAuth = () => new Promise((resolve) => {
    chrome.storage.local.remove(AUTH_KEY, () => resolve())
})

chrome.runtime.onInstalled.addListener(() => {
    clearLegacyPendingAuth()
    restoreProjectsSchedule().catch((error) => console.error('[background] restore schedule', error))
})
chrome.runtime.onStartup.addListener(() => {
    clearLegacyPendingAuth()
    restoreProjectsSchedule().catch((error) => console.error('[background] restore schedule', error))
})

// Обновление индикатора при переключении вкладок
chrome.tabs.onActivated.addListener(({ tabId }) => updateBadgeForTab(tabId))
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'complete') updateBadgeForTab(tabId)
})

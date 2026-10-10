import { findAccessesByUrl, findProjectByUrl, getAdminUrl } from '../utils/projectUtils.js'
import { apiAuthorizationError, classifyApiAuthorization } from './apiAuthorization.js'
import { registerPopupSession } from './popupSession.js'
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

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

registerPopupSession()

const DATA_KEY = 'projectData'
// Preserve the cache key for existing vaults; new API responses replace the whole list.
const SERVICES_KEY = 'manualServices'
const SETTINGS_KEY = 'apiSettings'
const API_SETTINGS_KEY_STORAGE = 'apiSettingsKey'
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
    projectApiStatus: '',
    accessApiStatus: '',
    accessAuthRequired: false,
    refreshErrors: [],
    lastSuccessfulData: {
        projects: [],
        accesses: [],
        servicesCount: 0,
        projectsUpdatedAt: null,
        accessesUpdatedAt: null,
        projectsUrl: '',
        accessesUrl: ''
    }
})

const emptySettings = () => ({ projectsUrl: '', accessUrl: '' })

// --- Шифрование адресов API ---
// Ключ приложения лежит в chrome.storage.local рядом с зашифрованными значениями:
// это защита от чтения адресов в открытую, а не от злоумышленника с доступом
// к хранилищу (фон должен работать без разблокировки vault).
const getApiSettingsKey = async () => {
    let raw = await storageGet(API_SETTINGS_KEY_STORAGE, null)
    if (!raw) {
        raw = bytesToBase64(randomBytes(32))
        await storageSet(API_SETTINGS_KEY_STORAGE, raw)
    }
    return importAesKey(base64ToBytes(raw))
}

// Внутреннее чтение реальных адресов (расшифровка; старый открытый формат читается как есть)
const readApiSettingsRaw = async () => {
    const stored = await storageGet(SETTINGS_KEY, {})
    const source = stored && typeof stored === 'object' ? stored : {}
    const key = await getApiSettingsKey()
    const decode = async (sealed) => {
        if (!sealed) return ''
        if (typeof sealed === 'string') return sealed // устаревший формат
        try {
            return textDecoder.decode(await openBytes(sealed, key))
        } catch {
            return ''
        }
    }
    return {
        projectsUrl: await decode(source.projectsUrl),
        accessUrl: await decode(source.accessUrl)
    }
}

const writeApiSettingsRaw = async (raw) => {
    const key = await getApiSettingsKey()
    const seal = async (value) => value ? sealBytes(textEncoder.encode(value), key) : null
    await storageSet(SETTINGS_KEY, {
        projectsUrl: await seal(raw.projectsUrl),
        accessUrl: await seal(raw.accessUrl)
    })
}

const toPublicApiSettings = (raw) => ({
    hasProjectsUrl: Boolean(raw.projectsUrl),
    hasAccessUrl: Boolean(raw.accessUrl)
})

// Patch-сохранение: передаются только изменённые поля; пустая строка удаляет адрес
const saveApiSettings = async ({ projectsUrl, accessUrl } = {}) => {
    const current = await readApiSettingsRaw()
    const next = { ...current }
    if (projectsUrl !== undefined) next.projectsUrl = String(projectsUrl ?? '').trim()
    if (accessUrl !== undefined) next.accessUrl = String(accessUrl ?? '').trim()
    await writeApiSettingsRaw(next)
    await scheduleProjectsRefresh(next)
    return next
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

// Логины сайтов храним открыто (показываются в интерфейсе), шифруются пароли и FTP.
const publicAccess = (access) => ({
    url: access.url,
    name: access.name,
    login: access.login || '',
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
        // В vault — только секреты: пароль и FTP. Логин остаётся в открытых данных.
        accesses: data.lastSuccessfulData.accesses.map((access) => ({
            url: access.url,
            password: access.password || '',
            ftp: access.ftp || null
        })),
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

const unlockWithWrappingKey = async (config, wrappingKey, options) => {
    try {
        const rawKey = await openBytes(config.wrappedKey, wrappingKey)
        return unlockWithVaultKey(config, rawKey, options)
    } catch {
        throw new Error('Неверный PIN или хранилище повреждено')
    }
}

const unlockWithVaultKey = async (config, rawKey, { refreshAfterUnlock = true } = {}) => {
    if (rawKey.length !== 32) throw new Error('Получен некорректный ключ хранилища')
    const vaultKey = await importAesKey(rawKey)
    await readCredentialVault(vaultKey)
    await storeUnlockedKey(rawKey)
    if (refreshAfterUnlock) refreshDueData().catch(error => console.error('[background] refresh after unlock', error))
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
    if (typeof pin !== 'string' || !/^\d{4,12}$/.test(pin)) {
        throw new Error('PIN должен содержать от 4 до 12 цифр')
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

const unlockWithPin = async ({ pin, refreshAfterUnlock = true }) => {
    const config = await getSecurityConfig()
    if (!config?.enabled || config.mode !== 'pin') throw new Error('PIN-защита не настроена')
    if (typeof pin !== 'string' || !/^\d{4,12}$/.test(pin)) throw new Error('Введите PIN от 4 до 12 цифр')
    if (!Number.isInteger(config.iterations) || config.iterations < 100000 || config.iterations > 2000000 ||
        base64ToBytes(config.salt || '').length !== 16) {
        throw new Error('Параметры PIN-хранилища повреждены')
    }
    const wrappingKey = await derivePinWrappingKey(pin, base64ToBytes(config.salt), config.iterations)
    return unlockWithWrappingKey(config, wrappingKey, { refreshAfterUnlock })
}

const unlockWithWindowsHelloKey = async ({ key, refreshAfterUnlock = true }) => {
    const config = await getSecurityConfig()
    if (!config?.enabled || config.mode !== 'hello') throw new Error('Windows Hello-защита не настроена')
    if (typeof key !== 'string') throw new Error('Windows Hello не вернул ключ vault')
    return unlockWithVaultKey(config, base64ToBytes(key), { refreshAfterUnlock })
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
            login: access.login || secret?.login || '',
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

const scheduleProjectsRefresh = async ({ projectsUrl, accessUrl }) => {
    if (!projectsUrl?.trim() && !accessUrl?.trim()) {
        await chrome.alarms.clear(PROJECTS_ALARM)
        return
    }
    if (await chrome.alarms.get(PROJECTS_ALARM)) return
    await chrome.alarms.create(PROJECTS_ALARM, {
        delayInMinutes: PROJECTS_REFRESH_PERIOD_MINUTES,
        periodInMinutes: PROJECTS_REFRESH_PERIOD_MINUTES
    })
}

const restoreProjectsSchedule = async () => {
    const settings = await readApiSettingsRaw()
    await scheduleProjectsRefresh(settings)
    await refreshDueData()
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
        ? { name: item[0], url: item[1], manual: item[2], urlAdmin: item[3], cms: item[4], ticketKey: item[5], git: item[6] }
        : item || {}
    return {
        name: asText(value.name || value.title || value.project),
        url: getUrlKey(value.url || value.site || value.domain),
        urlAdmin: asText(value.urlAdmin || value.adminUrl),
        cms: asText(value.cms) || 'Нет',
        manual: asText(value.manual),
        ticketKey: asText(value.ticketKey),
        git: asText(value.git),
        addDocument: asText(value.addDocument)
    }
}

const normalizeAccess = (item) => {
    const value = Array.isArray(item)
        ? { name: item[0], url: item[1], login: item[2], password: item[3], ftpUrl: item[4], ftpLogin: item[5], ftpPassword: item[6] }
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
    })).filter((access) => access.login || access.password || access.ftp)
}

const normalizeService = (item, index) => {
    const value = Array.isArray(item) ? { name: item[0], url: item[1], login: item[2], password: item[3] } : item || {}
    if (![value.name, value.url, value.login, value.password].some((field) => asText(field))) return null
    const name = asText(value.name)
    const rawUrl = asText(value.url)
    if (!name || !rawUrl) throw new Error('В сервисе API должны быть указаны название и ссылка')
    let parsedUrl
    try {
        parsedUrl = new URL(rawUrl.includes(':') ? rawUrl : `https://${rawUrl}`)
    } catch {
        throw new Error(`Некорректная ссылка сервиса «${name}»`)
    }
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error(`Ссылка сервиса «${name}» должна использовать HTTP или HTTPS`)
    return {
        id: JSON.stringify([name, parsedUrl.href, index]),
        name,
        url: parsedUrl.href,
        login: asText(value.login),
        password: asText(value.password)
    }
}

const normalizeAccessData = (result) => ({
    accesses: result.access.flatMap(normalizeAccess),
    services: result.services.map(normalizeService).filter(Boolean)
})

const extractRows = (payload, kind) => {
    if (kind === 'доступов') {
        const result = payload?.result
        if (!Array.isArray(result?.access) || !Array.isArray(result?.services)) {
            throw new Error('Ответ API доступов должен содержать массивы result.access и result.services')
        }
        return result
    }
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
            credentials: 'include',
            redirect: 'follow',
            signal: controller.signal
        })
        const text = await response.text()
        const authStatus = classifyApiAuthorization(response, text)
        if (authStatus) throw apiAuthorizationError(authStatus, kind)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        let payload
        try {
            payload = JSON.parse(text)
        } catch {
            throw new Error(`Ответ API ${kind} не является JSON`)
        }
        return extractRows(payload, kind)
    } catch (error) {
        if (error.name === 'AbortError') throw new Error('Превышено время ожидания API')
        throw error
    } finally {
        clearTimeout(timeoutId)
    }
}

const saveSuccessfulData = async (data, type, rows, url) => {
    const snapshot = data.lastSuccessfulData
    let values = type === 'accesses' ? rows.accesses : rows
    let services = type === 'accesses' ? rows.services : null
    let encryptedVault = null
    if (type === 'accesses' && (await getSecurityConfig())?.enabled) {
        const key = await getUnlockedKey()
        const vault = await readCredentialVault(key)
        vault.accesses = values.map((access) => ({
            url: access.url,
            password: access.password || '',
            ftp: access.ftp || null
        }))
        vault.services = services.map(({ id, login, password }) => ({ id, login, password }))
        encryptedVault = await encryptCredentialVault(vault, key)
        values = values.map(publicAccess)
        services = services.map(({ login, password, ...service }) => ({
            ...service,
            hasLogin: Boolean(login),
            hasPassword: Boolean(password)
        }))
    }
    const nextSnapshot = {
        ...snapshot, [type]: values, [`${type}UpdatedAt`]: Date.now(), [`${type}Url`]: url,
        ...(services !== null ? { servicesCount: services.length } : {})
    }
    const nextData = {
        ...data,
        lastSuccessfulData: nextSnapshot,
        ...(type === 'projects' ? { projectApiStatus: '' } : { accessApiStatus: '', accessAuthRequired: false })
    }
    await storageSetMany({
        [DATA_KEY]: nextData,
        ...(services !== null ? { [SERVICES_KEY]: services } : {}),
        ...(encryptedVault ? { [VAULT_KEY]: encryptedVault } : {})
    })
    return nextData
}

const logError = async (type, error) => {
    const current = await storageGet(ERRORS_KEY, [])
    const entry = { type, message: error.message || String(error), createdAt: Date.now() }
    await storageSet(ERRORS_KEY, [entry, ...current].slice(0, MAX_ERROR_ENTRIES))
}

const recordApiFailure = async (type, error) => {
    const data = await getStoredData()
    const status = error.apiStatus || ''
    const change = type === 'projects' ? { projectApiStatus: status }
        : { accessApiStatus: status, accessAuthRequired: ['login_required', 'authorization_needed'].includes(status) }
    await storageSet(DATA_KEY, { ...data, ...change })
}

const refreshProjects = async (url, { interactive = false } = {}) => {
    try {
        const data = await getStoredData()
        return saveSuccessfulData(data, 'projects', (await requestRows(url, 'проектов')).map(normalizeProject), url)
    } catch (error) {
        await recordApiFailure('projects', error)
        await openConsentIfNeeded(error, url, 'проектов', interactive)
        await logError('projects', error)
        throw error
    }
}

const refreshAccesses = async (url, { interactive = false } = {}) => {
    try {
        if ((await getSecurityConfig())?.enabled) await getUnlockedKey()
        const data = await getStoredData()
        return await saveSuccessfulData(data, 'accesses', normalizeAccessData(await requestRows(url, 'доступов')), url)
    } catch (error) {
        await recordApiFailure('accesses', error)
        await openConsentIfNeeded(error, url, 'доступов', interactive)
        await logError('accesses', error)
        throw error
    }
}

const openApiAuthorizationUrl = async (url, kind) => {
    if (!url) throw new Error(`Сначала сохраните адрес API ${kind}`)
    let parsedUrl
    try {
        parsedUrl = new URL(url)
    } catch {
        throw new Error(`Некорректный адрес API ${kind}`)
    }
    if (!['http:', 'https:'].includes(parsedUrl.protocol) ||
        parsedUrl.username || parsedUrl.password) {
        throw new Error(`Адрес API ${kind} должен использовать HTTP или HTTPS и не содержать логин и пароль в URL`)
    }
    await chrome.tabs.create({ url: parsedUrl.href })
    return { opened: true }
}

const openApiAuthorization = async (type) => {
    const settings = await readApiSettingsRaw()
    return openApiAuthorizationUrl(type === 'projects' ? settings.projectsUrl : settings.accessUrl, type === 'projects' ? 'проектов' : 'доступов')
}

const openConsentIfNeeded = async (error, url, kind, interactive) => {
    if (!interactive || error.apiStatus !== 'authorization_needed') return
    try {
        await openApiAuthorizationUrl(url, kind)
    } catch (openError) {
        await logError(kind === 'проектов' ? 'projects' : 'accesses', openError)
    }
}

const getProjectAccessRecords = async (data, url, requireUnlocked = true) => {
    const publicRecords = findAccessesByUrl(data.lastSuccessfulData.accesses, url)
    if (!(await getSecurityConfig())?.enabled) return publicRecords
    const key = await getUnlockedKey({ required: requireUnlocked })
    if (!key) return publicRecords
    const vault = await readCredentialVault(key)
    const vaultRecords = vault.accesses.filter((access) => access.url === publicRecords[0]?.url)
    // Слияние: логин из открытых данных, пароль и FTP из vault (с запасом на старые записи)
    return publicRecords.map((record, index) => ({
        ...record,
        login: record.login || vaultRecords[index]?.login || '',
        password: vaultRecords[index]?.password || '',
        ...(vaultRecords[index]?.ftp ? { ftp: vaultRecords[index].ftp } : record.ftp ? { ftp: record.ftp } : {})
    }))
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

    const protectedMode = Boolean((await getSecurityConfig())?.enabled)
    const key = protectedMode ? await getUnlockedKey({ required: false }) : null
    const displayAccesses = await getProjectAccessRecords(data, url, false)

    return {
        locked: protectedMode && !key,
        accesses: displayAccesses.map(({ name, login, password, ftp, hasLogin, hasPassword, hasFtp, ftpUrl, ftpHasLogin, ftpHasPassword }) => ({
            name,
            login: login || '',
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

const getServiceField = async ({ id, field }) => {
    if (!['login', 'password'].includes(field)) throw new Error('Неизвестное поле сервиса')
    if ((await getSecurityConfig())?.enabled) await getUnlockedKey()
    const service = (await getServices()).find((item) => item.id === id)
    if (!service) throw new Error('Сервис не найден. Обновите список сервисов.')
    if (!service[field]) throw new Error(`${field === 'login' ? 'Логин' : 'Пароль'} сервиса не указан`)
    return service[field]
}

const refreshAll = async ({ interactive = false, onlyIfDue = false } = {}) => {
    const { projectsUrl, accessUrl } = await readApiSettingsRaw()
    if (!projectsUrl && !accessUrl) throw new Error('Сначала сохраните адрес API проектов или доступов')
    const protectedMode = Boolean((await getSecurityConfig())?.enabled)
    const locked = protectedMode && !(await getUnlockedKey({ required: false }))
    if (interactive && accessUrl && locked) await getUnlockedKey()
    let data = await getStoredData()
    const snapshot = data.lastSuccessfulData
    const due = (type, url) => !onlyIfDue || snapshot[`${type}Url`] !== url ||
        !Number.isFinite(snapshot[`${type}UpdatedAt`]) || snapshot[`${type}UpdatedAt`] <= 0 ||
        Date.now() - snapshot[`${type}UpdatedAt`] >= PROJECTS_REFRESH_PERIOD_MINUTES * 60000
    const loadProjects = Boolean(projectsUrl) && due('projects', projectsUrl)
    const loadAccesses = Boolean(accessUrl) && !locked && due('accesses', accessUrl)
    if (!loadProjects && !loadAccesses) return { ...data, refreshed: { projects: false, accesses: false } }
    const [projectsResult, accessesResult] = await Promise.allSettled([
        loadProjects ? requestRows(projectsUrl, 'проектов') : Promise.resolve(null),
        loadAccesses ? requestRows(accessUrl, 'доступов') : Promise.resolve(null)
    ])
    data = await getStoredData()
    const errors = []
    const refreshed = { projects: false, accesses: false }
    let accessAuthRequired = Boolean(data.accessAuthRequired) && Boolean(accessUrl)
    let projectApiStatus = projectsUrl ? data.projectApiStatus || '' : ''
    let accessApiStatus = accessUrl ? data.accessApiStatus || '' : ''
    for (const [type, result, url] of [['projects', projectsResult, projectsUrl], ['accesses', accessesResult, accessUrl]]) {
        try {
            if (result.status === 'rejected') throw result.reason
            if (result.value === null) continue
            const rows = type === 'projects' ? result.value.map(normalizeProject) : normalizeAccessData(result.value)
            data = await saveSuccessfulData(data, type, rows, url)
            refreshed[type] = true
            if (type === 'projects') projectApiStatus = ''
            else { accessApiStatus = ''; accessAuthRequired = false }
        } catch (error) {
            if (type === 'projects') projectApiStatus = error.apiStatus || ''
            else {
                accessApiStatus = error.apiStatus || ''
                accessAuthRequired = ['login_required', 'authorization_needed'].includes(accessApiStatus)
            }
            await openConsentIfNeeded(error, url, type === 'projects' ? 'проектов' : 'доступов', interactive)
            errors.push(`${type === 'projects' ? 'Проекты' : 'Доступы'}: ${error.message}`)
            await logError(type, error)
        }
    }
    if (accessUrl && locked) errors.push('Доступы: обновление пропущено, хранилище заблокировано')
    const nextData = { ...data, projectApiStatus, accessApiStatus, accessAuthRequired, refreshErrors: errors }
    await storageSet(DATA_KEY, nextData)
    return { ...nextData, refreshed }
}

let dueRefresh = null
const refreshDueData = () => {
    if (dueRefresh) return dueRefresh
    dueRefresh = (async () => {
        if ((await getSecurityConfig())?.enabled && !(await getUnlockedKey({ required: false }))) return
        const settings = await readApiSettingsRaw()
        if (!settings.projectsUrl && !settings.accessUrl) return
        return refreshAll({ onlyIfDue: true })
    })().finally(() => { dueRefresh = null })
    return dueRefresh
}

const toPublicData = (data) => {
    const snapshot = data.lastSuccessfulData
    const projectsByUrl = new Map(snapshot.projects.filter((project) => project.url).map((project) => [project.url, project]))

    for (const access of snapshot.accesses) {
        if (!access.url) continue
        if (!projectsByUrl.has(access.url)) {
            projectsByUrl.set(access.url, { name: access.name, url: access.url, cms: 'Нет' })
        }
    }

    return {
        ...data,
        lastSuccessfulData: {
            ...snapshot,
            projects: [...projectsByUrl.values()].map((project) => {
                const count = findAccessesByUrl(snapshot.accesses, project.url).length
                return { ...project, hasAccess: count > 0, accessCount: count }
            }),
            accesses: snapshot.accesses.map(publicAccess)
        }
    }
}

const handlers = {
    'services:get': getServices,
    'services:field': getServiceField,
    'data:settings:get': () => readApiSettingsRaw().then(toPublicApiSettings),
    'data:settings:set': (payload) => saveApiSettings(payload).then(toPublicApiSettings),
    'data:projects:get': () => getStoredData().then(toPublicData),
    'data:projects:refresh': ({ url }) => refreshProjects(url, { interactive: true }).then(toPublicData),
    'data:accesses:refresh': ({ url }) => refreshAccesses(url, { interactive: true }).then(toPublicData),
    'data:projects:authorize': () => openApiAuthorization('projects'),
    'data:accesses:authorize': () => openApiAuthorization('accesses'),
    'data:all:refresh': () => refreshAll({ interactive: true }).then(toPublicData),
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
    const internalOnly = !['auth:consume', 'seo:fetch'].includes(message.type)
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
    refreshDueData()
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

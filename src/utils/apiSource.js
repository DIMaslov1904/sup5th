import { base64UrlToBytes } from './credentialCrypto.js'

export const API_SOURCES = [['google', 'Google Таблица'], ['panel', 'Панель управления проектами']]

const normalizePanelUrl = address => {
    const url = URL.parse(address.trim())
    const local = url && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    if (!url || (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) || url.username || url.password || url.search || url.hash) {
        throw new Error('Укажите HTTPS-адрес панели. Для локальной панели подойдёт http://127.0.0.1:8000')
    }
    const path = url.pathname.replace(/\/+$/, '').replace(/\/admin(?:\/(?:login|profile))?$/, '')
    return url.origin + path
}

export const parsePanelConnection = value => {
    const invalid = 'Вставьте строку подключения из раздела SUP 5th профиля панели'
    const encoded = typeof value === 'string' && /^sup5th-connect-v1\.([A-Za-z0-9_-]+)$/.exec(value.trim())?.[1]
    if (!encoded) throw new Error(invalid)
    let connection
    try {
        connection = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(base64UrlToBytes(encoded)))
    } catch {
        throw new Error(invalid)
    }
    if (typeof connection?.url !== 'string' || typeof connection.token !== 'string' || !/^sup5th_[0-9a-f]{64}$/.test(connection.token)) {
        throw new Error(invalid)
    }
    return { panelUrl: normalizePanelUrl(connection.url), panelToken: connection.token }
}

export const apiUrls = (settings, panelTokenSaved = settings.panelTokenSaved) => {
    if (settings.source !== 'panel') return { projects: settings.projectsUrl, accesses: settings.accessUrl }
    if (!settings.panelUrl || !panelTokenSaved) return { projects: '', accesses: '' }
    const base = settings.panelUrl + '/api/v1/sup5th'
    return { projects: base + '/projects', accesses: base + '/accesses' }
}

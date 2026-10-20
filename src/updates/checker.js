import { compareVersions, readRelease, RELEASE_API } from './release.js'

export const UPDATE_INTERVAL = 24 * 60 * 60 * 1000
export const UPDATE_ALARM = 'extension-update-check'
export const UPDATE_STATE_KEY = 'extensionUpdateState'

/**
 * @typedef {object} UpdateStatus
 * @property {string} currentVersion
 * @property {'chromium' | 'firefox'} browser
 * @property {boolean} checking
 * @property {number | null} lastCheckedAt
 * @property {number | null} lastSuccessfulAt
 * @property {string} error
 * @property {string} latestVersion
 * @property {boolean} updateAvailable
 * @property {string} downloadUrl
 * @property {string} releaseUrl
 */

export const createUpdateChecker = ({ browser, currentVersion, read, write, alarms, fetch: request = fetch, now = Date.now }) => {
    let running = null, controller = null, generation = 0
    /** @returns {Promise<UpdateStatus>} */
    const getStatus = async () => {
        const saved = await read()
        const latest = saved?.release
        const updateAvailable = Boolean(latest && compareVersions(latest.version, currentVersion) > 0)
        return { currentVersion, browser, checking: Boolean(running), lastCheckedAt: saved?.lastCheckedAt || null,
            lastSuccessfulAt: saved?.lastSuccessfulAt || null, error: saved?.error || '',
            latestVersion: latest?.version || '', updateAvailable,
            downloadUrl: updateAvailable ? latest.downloadUrl : '', releaseUrl: latest?.releaseUrl || '' }
    }
    const schedule = async () => {
        const saved = await read()
        const when = Math.max(now() + 60000, (saved?.lastCheckedAt || 0) + UPDATE_INTERVAL)
        const alarm = await alarms.get(UPDATE_ALARM)
        if (!alarm || Math.abs(alarm.scheduledTime - when) > 60000 || alarm.periodInMinutes) await alarms.create(UPDATE_ALARM, { when })
    }
    const performCheck = async (force, revision) => {
        const previous = await read()
        if (revision !== generation) return getStatus()
        const checkedAt = now()
        if (!force && previous?.lastCheckedAt && checkedAt >= previous.lastCheckedAt && checkedAt - previous.lastCheckedAt < UPDATE_INTERVAL) return getStatus()
        const state = { ...previous, lastCheckedAt: checkedAt, error: 'Проверка была прервана. Повторите её.' }
        await write(state)
        if (revision !== generation) return getStatus()
        controller = new AbortController()
        const timeout = setTimeout(() => controller?.abort(), 15000)
        try {
            const response = await request(RELEASE_API, { credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store',
                redirect: 'error', signal: controller.signal, headers: { Accept: 'application/vnd.github+json' } })
            if (!response.ok) {
                if ([403, 429].includes(response.status)) throw new Error('GitHub ограничил число запросов. Повторите проверку позже.')
                if (response.status === 404) throw new Error('Стабильный релиз пока не опубликован.')
                throw new Error(`GitHub недоступен (HTTP ${response.status}). Повторите проверку позже.`)
            }
            const body = await response.text()
            if (body.length > 1024 * 1024) throw new Error('Слишком большой ответ сервера обновлений')
            state.release = readRelease(JSON.parse(body), browser)
            state.lastSuccessfulAt = now()
            state.error = ''
        } catch (error) {
            state.error = error.name === 'AbortError' ? 'Проверка заняла слишком много времени. Повторите её.'
                : error instanceof TypeError ? 'Не удалось связаться с GitHub. Проверьте подключение к сети.'
                : error instanceof SyntaxError ? 'GitHub вернул некорректный ответ. Повторите проверку позже.' : error.message
        } finally { clearTimeout(timeout); controller = null }
        if (revision === generation) await write(state)
        return getStatus()
    }
    const check = ({ force = false } = {}) => {
        if (running) return running
        running = performCheck(force, generation).finally(async () => { running = null; await schedule() })
            .then(getStatus)
        return running
    }
    const start = async () => { await schedule(); return check() }
    const cancel = async () => { generation++; controller?.abort(); await running?.catch(() => {}) }
    return { getStatus, check, start, cancel }
}

export const classifyLinkCheck = info => {
    if (info.ok) return { outcome: 'ok', label: `HTTP ${info.status}` }
    if (info.failure === 'permission') return { outcome: 'unknown', label: 'Нет разрешения на сайт' }
    if (info.failure === 'timeout') return { outcome: 'unknown', label: 'Таймаут проверки' }
    if ([401, 407].includes(info.status)) return { outcome: 'auth', label: 'Требуется авторизация' }
    if ([403, 429].includes(info.status)) return { outcome: 'blocked', label: `Проверка ограничена: HTTP ${info.status}` }
    if ([404, 410].includes(info.status)) return { outcome: 'broken', label: `Страница отсутствует: HTTP ${info.status}` }
    if (info.status >= 500) return { outcome: 'server', label: `Ошибка сервера: HTTP ${info.status}` }
    return { outcome: 'unknown', label: info.status ? `HTTP ${info.status}: требуется проверка` : 'Сетевая ошибка: результат неизвестен' }
}
export const withoutFragment = value => { const url = new URL(value); url.hash = ''; return url.href }

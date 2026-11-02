export const inspectAuditLlm = (url, info) => {
    const html = /^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i.test(info.headers?.['content-type'] || '')
        || /^\s*(?:<!doctype\s+html|<html\b)/i.test(info.text || '')
    const truncated = info.truncated === true || info.status === 206
    return {
        url, finalUrl: info.url || url, status: info.status || 0, pending: false,
        exists: info.ok === true && info.status === 200 && !html && !truncated,
        invalid: info.ok === true && html, truncated,
        failure: info.failure, size: info.text?.length ?? null,
        headers: info.headers || {}, ttfb: info.ttfb ?? null
    }
}

export const auditLlmCheck = file => {
    if (!file || file.pending) return { status: 'unknown', hint: 'Проверка llm.txt выполняется' }
    if (file.skipped) return { status: 'na', hint: 'В режиме внешних ссылок файл не проверяется' }
    if (file.exists) return { status: 'pass', hint: `Найден в корне сайта · HTTP ${file.status}${file.size != null ? ` · ${file.size} симв.` : ''}` }
    if (file.invalid) return { status: 'warning', hint: 'Вместо llm.txt сервер вернул HTML' }
    if ([404, 410].includes(file.status)) return { status: 'warning', hint: `Файл не найден · HTTP ${file.status}` }
    if (file.truncated) return { status: 'unknown', hint: 'Получена только часть llm.txt' }
    return { status: 'unknown', hint: file.status ? `Не удалось проверить llm.txt · HTTP ${file.status}` : 'Не удалось получить ответ для llm.txt' }
}

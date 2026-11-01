// Оценка индексации через site:-запросы к поисковикам. Результат приблизительный:
// выдача зависит от антибот-защиты, капчи и региона, точное количество страниц
// поисковики не раскрывают. Запросы выполняются через background ('seo:fetch').
const extractCount = (text, patterns) => {
    for (const pattern of patterns) {
        const match = text.match(pattern)
        if (!match) continue
        const value = Number(match[1].replace(/[\s\u00a0,.\u202f]/g, ''))
        if (Number.isFinite(value) && value >= 0) return value
    }
    return null
}

const searchUrl = (engine, host) => engine === 'yandex'
    ? `https://yandex.ru/search/?text=${encodeURIComponent(`site:${host}`)}`
    : `https://www.google.com/search?hl=ru&num=20&q=${encodeURIComponent(`site:${host}`)}`

const checkEngineIndexation = async (engine, url, fetchResource) => {
    const idle = { found: null, status: 'idle' }
    let host
    try { host = new URL(url).hostname } catch { return idle }
    if (!/^https?:$/.test(new URL(url).protocol)) return idle
    try {
        const info = await fetchResource(searchUrl(engine, host), 'GET')
        if (!info?.ok) return { found: null, status: 'error' }
        const text = String(info.text || '')
        const captcha = /captcha|unusual traffic|подтвердите, что запросы отправляли вы|подтвердите, что вы не робот/i.test(text)
        const found = engine === 'yandex'
            ? extractCount(text, [/Нашл(?:ось|ась)\s+([\d\s\u00a0,.]+)\s*(?:тыс\.?|млн|млрд)?\s*(?:ответ|страниц|результат)/i, /([\d\s\u00a0]+)\s*(?:ответ|страниц|результат)/i])
            : extractCount(text, [/(?:Примерно|About)\s+([\d\s\u00a0,.]+)\s*(?:результат|result)/i, /([\d\s\u00a0,.]+)\s*(?:результат|results)/i])
        if (captcha && found == null) return { found: null, status: 'limited' }
        if (found == null) return { found: null, status: 'limited' }
        return { found, status: 'ok' }
    } catch { return { found: null, status: 'error' } }
}

export const checkSearchIndexation = async (url, fetchResource) => ({
    yandex: await checkEngineIndexation('yandex', url, fetchResource),
    google: await checkEngineIndexation('google', url, fetchResource)
})

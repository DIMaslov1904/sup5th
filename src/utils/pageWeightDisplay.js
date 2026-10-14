export const formatBytes = bytes => {
    if (!Number.isFinite(bytes) || bytes < 0) return 'Не измерен'
    const units = ['Б', 'КБ', 'МБ', 'ГБ']
    const index = bytes ? Math.max(0, Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)) : 0
    return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: index ? 1 : 0 }).format(bytes / 1024 ** index)} ${units[index]}`
}

export const pageWeightRows = weight => [
    { label: 'HTML документа', value: weight ? (weight.htmlEstimated ? '≈ ' : '') + formatBytes(weight.htmlBytes) : 'Не измерен' },
    { label: 'Вес страницы', value: weight ? (weight.partial && weight.bodyBytes !== null ? '≈ ' : '') + formatBytes(weight.bodyBytes) : 'Не измерен' }
]

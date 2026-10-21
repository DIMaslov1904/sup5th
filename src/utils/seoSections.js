export const SEO_SECTIONS = [['overview', 'Обзор'], ['headings', 'Заголовки'], ['links', 'Ссылки'], ['images', 'Изображения'], ['markup', 'Разметка'], ['index', 'Индексация'], ['page', 'Страница'], ['tools', 'Инструменты']]
export const normalizeSeoSection = section => SEO_SECTIONS.some(([name]) => name === section) ? section : 'overview'
export const seoAppUrl = (base, tabId, tool = 'seo', section = '') => {
    const url = new URL(base)
    url.searchParams.set('tool', tool)
    url.searchParams.set('tabId', String(tabId))
    if (section) url.searchParams.set('section', normalizeSeoSection(section))
    return url.href
}

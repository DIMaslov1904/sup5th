export const yandexCounterUrl = (pageUrl, theme) =>
    `https://yandex.ru/cycounter?${encodeURIComponent(new URL(pageUrl).hostname)}&theme=${theme === 'dark' ? 'dark' : 'light'}`

# Материалы карточки Opera Add-ons

## Название

SUP 5th

## Категория

Web Development

## Summary (ru)

Ассистент сопровождения сайтов: проекты и доступы, SEO-анализ страниц и работа с тикетами.

## Description (ru)

SUP 5th помогает сопровождать сайты из одного окна браузера. Откройте расширение на нужном сайте, чтобы найти проект, скопировать доступ или проверить страницу.

В popup доступны поиск по проектам и сервисам, карточки доступов, заполнение поддерживаемых форм входа, SEO-метаданные, заголовки, ссылки и изображения страницы. Подробный аудит и объединение sitemap открываются на отдельной странице расширения. На support.5th.ru расширение помогает учитывать рабочее время и заполнять форму тикета.

Каталог подключается через собственные API в формате JSON. Google-аккаунт нужен только для защищённого Google Apps Script, если вы выбрали такой источник. Для знакомства доступны публичные демонстрационные данные из инструкции; рабочие таблицы и доступы не входят в пакет.

Пароли хранятся в профиле браузера. При включённой защите секреты шифруются; возможности проверки устройства зависят от браузера, ОС и провайдера WebAuthn. Без включённой защиты пароли хранятся локально без шифрования.

Фоновая работа: раз в неделю обновляются подключённые API и кешируются иконки сайтов. На support.5th.ru локально учитывается время работы с тикетом; защищённые доступы блокируются при системном бездействии. SEO-проверки начинаются при открытии SEO. Яндекс ИКС загружается только после «Получить» с передачей домена сайта.

Интерфейс автоматически использует светлую или тёмную тему системы. Проект открыт под MIT, рекламы и собственного сервера аналитики нет.

## Ссылки

- Homepage: https://github.com/DIMaslov1904/sup5th
- Support: https://github.com/DIMaslov1904/sup5th/issues
- Privacy: https://github.com/DIMaslov1904/sup5th/blob/main/docs/PRIVACY.md
- License: https://github.com/DIMaslov1904/sup5th/blob/main/LICENSE
- Testing: https://github.com/DIMaslov1904/sup5th/blob/main/docs/TESTING.md

## Заметка модератору (en)

The single purpose of SUP 5th is website maintenance: project lookup, credential handling, page SEO checks and support-ticket workflow assistance.

For testing without a Google account, use the public raw JSON endpoints and onboarding steps in TESTING.md. The fixtures contain 2 projects, 3 website credentials and 2 services. Credentials are fictional and will not log into example.com/example.org. The Google Apps Script and support.5th.ru integrations require an authorized account; arrange a separate safe test account privately if required. Device verification is optional during onboarding.

All executable JavaScript is packaged locally. The Vite output is minified; readable source and the lockfile are available in the matching release tag. Source download: `https://github.com/DIMaslov1904/sup5th/archive/refs/tags/v<VERSION>.zip`. Replace `<VERSION>` with the submitted package version. Build with Node.js 24.13.1: `npm ci`, then `npm run build`. The result is `release/sup5th-v<VERSION>.zip`; the Opera release asset is a byte-identical copy with the Opera filename. ZIP timestamps and platform-dependent compression may differ between local and CI builds; compare extracted files and manifest.

The extension refreshes configured APIs weekly and caches site icons. Network recipients and local storage behavior are documented in PRIVACY.md. The Yandex image is opt-in and is never requested before clicking Get/Получить. Permission purposes are listed in OPERA-ADDONS.md. No advertising or developer-operated analytics endpoint is present.

Do not include this template's angle-bracket placeholder in the final submission. Paste the actual versioned source URL and test-account details, if needed, only in the appropriate reviewer fields.

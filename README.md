# Браузерное расширение SUP 5th

### Единый интерфейс

Цвета, скругления и общие стили задаются в `src/styles/main.css` через Tailwind v4 `@theme` и классы `ui-*`. Градиентный фон общий для popup и окна инструментов. Основной текст — 13 px, подписи — 12 px, заголовки — 16 px. Поля и основные кнопки имеют высоту 36 px, компактные кнопки — 28 px.

Для новых интерфейсов используйте компоненты из `src/popup/components/ui`: `Button`, `IconButton`, `Input`, `Select`, `Card`, `ActionMenu`, `Modal`, `Tabs`, `Message`, `EmptyState`, `PageHeader`. Специальные карточки используют `ui-panel`, меню — `ui-menu-item`; отдельные цвета и размеры для стандартных элементов не задаются в страницах. Семантические состояния: ошибка — красный, предупреждение — жёлтый, успех — зелёный.

### Стек
* Vue 3
* Vite
* TailwindCSS 4

### Сценарии
```bash
# Установка
npm i

# Запуск в режиме разработки
npm run dev

# Сборка
npm run build
```


### Текущая структура
```
src/
├── assets/icons/          # PNG иконки + SVG CMS-иконки
├── background/
│   ├── service-worker.js  # Основной background script
│   └── credentialCrypto.js # AES-GCM утилиты
├── content-script/
│   ├── index.js           # Авторизация в админках
│   ├── seo.js             # SEO скан
│   └── support.js         # Модификации для support
├── popup/
│   ├── App.vue            # Root с навигацией
│   ├── components/        # Layout, LeftMenu, UnlockModal, UI primitives
│   ├── views/             # Страницы
│   ├── data/              # projectData.js (background communication)
│   └── unlockStore.js     # PIN/Hello unlock flow
├── options/
│   └── App.vue            # Общее приложение: инструкция, SEO-аудит, sitemap
├── styles/
│   └── main.css           # Глобальные стили
└── utils/
    ├── projectUtils.js    # CMS paths, findProjectByUrl, getAdminUrl
    ├── switcher.js        # EN↔RU switch + translit
    └── biometricHello.js  # WebAuthn PRF for Windows Hello
```

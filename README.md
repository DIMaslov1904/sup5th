# Браузерное расширение SUP 5th

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

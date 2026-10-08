# Браузерное расширение 5th

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

# Собрать для отправки
npm run pack
```


### Текущая структура
```
src/
├── assets/icons/          # PNG иконки + SVG CMS-иконки
├── background/
│   ├── service-worker.js  # Основной background script
│   └── credentialCrypto.js # AES-GCM утилиты
├── content-script/
│   ├── index.js           # Admin auth
│   ├── seo.js             # SEO scan
│   └── support.js         # Support 5th.ru integration
├── popup/
│   ├── App.vue            # Root с навигацией
│   ├── components/        # Layout, LeftMenu, UnlockModal, UI primitives
│   ├── views/             # Site, Projects, Services, Settings
│   ├── data/              # projectData.js (background communication)
│   └── unlockStore.js     # PIN/Hello unlock flow
├── seo/
│   └── App.vue            # SEO audit page
├── options/
│   └── App.vue            # Google Sheets API setup guide
├── styles/
│   └── main.css           # @import "tailwindcss"
└── utils/
    ├── projectUtils.js    # CMS paths, findProjectByUrl, getAdminUrl
    ├── switcher.js        # EN↔RU switch + translit
    └── biometricHello.js  # WebAuthn PRF for Windows Hello
```

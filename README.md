# SUP 5th

Расширение для работы с проектами и доступами, автологина и SEO-анализа страниц.

## Браузеры и установка

Скачайте пакет из [Releases](https://github.com/DIMaslov1904/sup5th/releases), раздел **Assets**.

| Браузер | Пакет | Установка |
| --- | --- | --- |
| Chrome 130+; Edge, Opera, Яндекс Браузер на Chromium 130+ | `sup5th-chromium-v*.zip` | Распаковать → менеджер расширений → режим разработчика → «Загрузить распакованное расширение». |
| Firefox Desktop 140+ | Подписанный `.xpi` | Перенести скачанный xpi файл в окно браузера |

После установки разрешите доступ к нужным сайтам и API. В настройках расширения укажите адреса API проектов и доступов. Обновления устанавливаются вручную из Releases.

## Ограничения

**Firefox**

- Биометрия экспериментальна: открывается в отдельной вкладке; известна ошибка WebAuthn `The operation is insecure`.

## Стек и сборка

Manifest V3 · Vue 3 · JavaScript / TypeScript · Vite 8 · Tailwind CSS 4 · CRXJS · IndexedDB / Web Crypto.

Node.js 24.13.1:

```bash
npm ci
npm run build:all
```

Результат: `dist` (Chromium), `dist-firefox`; ZIP-пакеты — в `release/`. `npm run build:release` собирает только Chromium; подписанный Firefox XPI добавляется в релиз вручную.

## API

Два GET-адреса Google Apps Script задаются в настройках. Запросы отправляются с cookies Google; доступ определяется настройками Apps Script. Автообновление — раз в сутки, ручное — в любое время; защищённые доступы загружаются после разблокировки.

Примеры запросов (`PROJECTS_ID` и `ACCESS_ID` — идентификаторы развёртываний):

```http
GET https://script.google.com/macros/s/PROJECTS_ID/exec
GET https://script.google.com/macros/s/ACCESS_ID/exec
```

Ответ проектов. Порядок полей: название, сайт, инструкция, админка, CMS, ключ тикета, Git.

```json
{
  "result": [
    ["Проект", "https://example.org", "Инструкция", "https://example.org/admin/", "Битрикс", "ticket-key", "https://git.example.org/project"]
  ]
}
```

Ответ доступов. `access`: название, сайт, логин, пароль, FTP-хост, FTP-логин, FTP-пароль. `services`: название, URL, логин, пароль.

```json
{
  "result": {
    "access": [
      ["Проект", "https://example.org", "login", "password", "ftp.example.org", "ftp-user", "ftp-password"]
    ],
    "services": [
      ["Сервис", "https://service.example.org", "login", "password"]
    ]
  }
}
```

Пустые значения — `""`. Несколько логинов и соответствующих паролей разделяются `\n`. Префикс `!` у сайта (`!https://example.org`) исключает поддомены; без него запись действует и на них.

# Выпуск SUP 5th

Исходники, примеры данных, сборки и канал обновлений находятся в `DIMaslov1904/sup5th`.

## Автоматическая сборка релиза

1. Измените `version` в `package.json` и синхронизируйте версию в `package-lock.json`.
2. Проверьте изменения в целевых браузерах. Выполните `npm ci`, `npm run build`, `npm run build:firefox`, `npm run lint:firefox`.
3. Закоммитьте исходники и отправьте `main`.
4. Создайте тег на этом коммите: `git tag v<версия>`, затем `git push origin v<версия>`.
5. Дождитесь успешного **Actions → Build release**. Он устанавливает зависимости из lockfile и собирает:
   - `sup5th-opera-v<версия>.zip` — пакет для Opera Add-ons / ручной проверки;
   - `sup5th-chrome-v<версия>.zip` — распакованная установка в Chrome;
   - `sup5th-firefox-v<версия>.zip` — неподписанный Firefox для тестирования и отправки Mozilla.

Workflow проверяет совпадение тега с версией и текущим коммитом, создаёт GitHub Release, добавляет SHA-256 и справочные `updates/chrome.json`, `updates/opera.json`. Старые версии и файлы не заменяются другим содержимым.

Ручной запуск **Build release** принимает уже существующий тег. Если релиз создан, повторная сборка не перезаписывает его; для исправления содержимого увеличьте версию. Если сбой произошёл только на публикации метаданных, запустите **Publish release metadata** для того же тега.

Сборки GitHub не публикуются в магазины автоматически. Наличие ZIP в Releases не означает одобрение Opera или подпись Mozilla.

## Opera Add-ons

Скачайте Opera ZIP именно из релиза и загрузите его в [кабинет разработчика](https://addons.opera.com/developer/). Приложите данные из [OPERA-ADDONS.md](OPERA-ADDONS.md), ссылку на исходники конкретного тега и инструкции проверки. Для обновления используйте Upgrade у того же дополнения; пользователи установленной магазинной версии получают обновления через Opera Add-ons.

## Подписанный Firefox

1. Отправьте Firefox ZIP на подпись Mozilla в канале **On your own / Самостоятельно**. Укажите исходники того же тега, Node.js 24.13.1 и команды `npm ci`, `npm run build:firefox`.
2. Скачайте XPI, не меняя его содержимое. Назовите `sup5th-firefox-v<версия>.xpi` и добавьте к существующему релизу.
3. Запустите **Publish release metadata** с тегом версии. Workflow проверит manifest, ID `sup5th@5th.ru`, постоянный update_url и наличие блоков подписи; криптографическую подлинность подписи проверяет Firefox при установке.
4. Проверьте обновление с предыдущего подписанного XPI через `about:addons` → меню шестерёнки → «Проверить наличие обновлений». Проверьте сохранность данных.

Неподписанный ZIP никогда не попадает в `updates/firefox.json`. Подпись нужна для каждой новой устанавливаемой версии. Биометрия Firefox пока экспериментальная; постоянная установка сама по себе не исправляет ошибку RP ID.

## Контрольная сумма

`SHA256SUMS.txt` содержит хеш каждого прикреплённого пакета. Метаданные используют постоянные ссылки на конкретный тег. Повторная публикация старого релиза не понижает версию в канале обновлений. Новый файл с прежним номером и другим хешем отклоняется.

Документация: [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases), [Mozilla signing](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/), [Firefox update manifest](https://extensionworkshop.com/documentation/manage/updating-your-extension/).

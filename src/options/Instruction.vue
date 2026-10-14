<template>
  <div
    class="w-full text-ui-text text-[13px] leading-relaxed">
    <div class="max-w-3xl">
      <h1 class="ui-title mb-4">Инструкция по созданию api в гугл таблице</h1>
      <ol>
        <li>Переходим в Вашу таблицу доступов</li>
        <li>Необходимо задать название листа <b class="bg-ui-raised px-2 rounded">Доступы к сайтам</b></li>
        <li>
          Проверяем столбцы
          <ul class="grid grid-cols-4 mb-3">
            <li>[A] Название</li>
            <li>[B] Адрес</li>
            <li>[C] Логин</li>
            <li>[D] Пароль</li>
            <li>[E] Домен</li>
            <li>[F] Логин</li>
            <li>[G] Пароль</li>
          </ul>
        </li>
        <li>
          Создайте лист <b class="bg-ui-raised px-2 rounded">Корпоративные доступы</b> со столбцами
          [A] Название, [B] Ссылка, [C] Логин, [D] Пароль. Первая строка — заголовки.
          Логин и пароль можно оставить пустыми.
        </li>
        <li>В верхнем меню выбираем &#128073;Расширения &#128073;Apps script</li>
        <li>
          Копируем код: <Button size="sm" variant="secondary" @click="copyCode">
            {{ copyCodeText }}
          </Button>
        </li>
        <li>Вставляем код в редактор, удаляя пустую функцию по умолчанию</li>
        <li>Нажимаем сверху кнопку &#128073;Начать развертывание</li>
        <li>&#128073;Новое развертывание</li>
        <li>
          Выберите тип, нажимаем шестеренку, выбираем &#128073;Веб-приложение
        </li>
        <li>У кого есть доступ, ставим - &#128073;Только у меня</li>
        <li>Предоставить доступ, дальше авторизация через гугл</li>
        <li>
          ‼️На странице с восклицательным знаком - &#128073;Advanced &#128073;Go
          to ... (unsafe)
        </li>
        <li>Копируем URL</li>
        <li>
          Вставляем в поле <b class="bg-ui-raised px-2 rounded">API получения личных доступов</b>
        </li>
      </ol>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import Button from '../popup/components/ui/Button.vue'

defineEmits(["return"]);

const copyCodeText = ref("Скопировать код");

const copyCode = () => {
  navigator.clipboard
    .writeText(
      `
const ACCESS_SHEET_NAME = 'Доступы к сайтам'
const SERVICES_SHEET_NAME = 'Корпоративные доступы'


const getData = () => {
  const ss = SpreadsheetApp.getActiveSpreadsheet()

  const sheetAccess = ss.getSheetByName(ACCESS_SHEET_NAME)
  if (!sheetAccess) throw new Error(\`Лист '${ACCESS_SHEET_NAME}' не найден\`)

  const sheetServices = ss.getSheetByName(SERVICES_SHEET_NAME)
  if (!sheetServices) throw new Error(\`Лист '${SERVICES_SHEET_NAME}' не найден\`)

  const res = {
    access: [],
    services: []
  }

  const lastRowAccess = sheetAccess.getLastRow() - 1
  if (lastRowAccess > 0) res.access = sheetAccess.getRange(2, 1, lastRowAccess, 7).getValues()

  const lastRowServices = sheetServices.getLastRow() - 1
  if (lastRowServices > 0) res.services = sheetServices.getRange(2, 1, lastRowServices, 4).getValues()

  return res
}


const doGet = () => {
  try {
    const cache = CacheService.getScriptCache()
    const cached = cache.get('sheet_data')
    const result = cached ? JSON.parse(cached) : getData()

    if (!cached) cache.put('sheet_data', JSON.stringify(result), 120)

    return ContentService
      .createTextOutput(JSON.stringify({ result }))
      .setMimeType(ContentService.MimeType.JSON)
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON)
  }
}
`,
    )
    .then(() => {
      copyCodeText.value = "Скопировано!";
      setTimeout(() => {
        copyCodeText.value = "Скопировать код";
      }, 1500);
    });
};
</script>

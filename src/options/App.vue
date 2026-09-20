<template>
  <div
    class="flex justify-center items-center w-full h-full bg-linear-[135deg,#0f172a,0%,#1e293b,30%,#334155,60%,#1e293b] text-white text-xl">
    <div class="max-w-3xl">
      <h1 class="text-3xl font-bold mb-5">Инструкция по созданию api в гугл таблице</h1>
      <ol>
        <li>Переходим в Вашу таблицу доступов</li>
        <li>Необходимо задать название листа <b class="bg-gray-500 px-2 rounded">Доступы к сайтам</b></li>
        <li>
          Проверяем столбцы
          <ul class="grid grid-cols-4 mb-3">
            <li>[A] Название</li>
            <li>[B] Адрес</li>
            <li>[C] Логин</li>
            <li>[D] Пароль</li>
          </ul>
        </li>
        <li>
          Для выгрузки с ftp доступами, проверьте еще
          <ul class="grid grid-cols-4 mb-3">
            <li>[F] Домен</li>
            <li>[G] Логин</li>
            <li>[H] Пароль</li>
          </ul>
        </li>
        <li>В верхнем меню выбираем &#128073;Расширения &#128073;Apps script</li>
        <li>
          Копируем код: <button @click="copyCode"
            class="rounded bg-slate-800 py-1 px-2.5 border border-transparent text-center text-sm text-white transition-all shadow-sm hover:shadow focus:bg-slate-700 focus:shadow-none active:bg-slate-700 hover:bg-slate-700 active:shadow-none disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none cursor-pointer"
            type="button">
            {{ copyCodeText }}
          </button>
        </li>
        <li>Вставляем код в редактор, удаляя пустую функцию по умолчанию</li>
        <li>Нажимаем сверху кнопку &#128073;Начать развертывание</li>
        <li>&#128073;Новое развертывание</li>
        <li>
          Выберите тип, нажимаем шестеренку, выбираем &#128073;Веб-приложение
        </li>
        <li>У кого есть доступ, ставим - &#128073;Все</li>
        <li>Предоставить доступ, дальше авторизация через гугл</li>
        <li>
          ‼️На странице с восклицательным знаком - &#128073;Advanced &#128073;Go
          to ... (unsafe)
        </li>
        <li>Копируем URL</li>
        <li>
          Вставляем в поле <b class="bg-gray-500 px-2 rounded">API получения личных доступов</b>
        </li>
      </ol>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";

defineEmits(["return"]);

const copyCodeText = ref("Скопировать код");

const copyCode = () => {
  navigator.clipboard
    .writeText(
      `
const ss = SpreadsheetApp.getActiveSpreadsheet()

const getData = (range = 'A:D') => {
  const s = ss.getSheetByName("Доступы к сайтам")
  if (!s) throw new Error("Лист 'Доступы к сайтам' не найден")
  const v = s.getRange(range).getValues()
  return v.slice(1, s.getLastRow())
}

const doGet = (e) => {
  try {
    const result = e?.parameter?.get === 'ftp' ? getData('A:H') : getData()
    return ContentService.createTextOutput(JSON.stringify({result})).setMimeType(ContentService.MimeType.JSON)
  } catch (e) {
    return ContentService.createTextOutput(JSON.stringify({'error': e.message})).setMimeType(ContentService.MimeType.JSON)
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

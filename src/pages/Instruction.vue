<template>
  <Content class="instruction-page">
    <h2>Инструкция по созданию api в гугл таблице</h2>
    <ol>
      <li>Переходим в нашу таблицу доступов</li>
      <li>Проверяем название листа. Должно быть так же "Доступы к сайтам"</li>
      <li>
        Проверяем столбцы
        <ul>
          <li>[A] Название</li>
          <li>[B] Адрес</li>
          <li>[C] Логин</li>
          <li>[D] Пароль</li>
        </ul>
      </li>
      <li>
        Для выгрузки с ftp доступами, проверьте еще
        <ul>
          <li>[E] стобец не выгружается</li>
          <li>[F] Домен</li>
          <li>[G] Логин</li>
          <li>[H] Пароль</li>
        </ul>
      </li>
      <li>В верхнем меню выбираем &#128073;Расширения &#128073;Apps script</li>
      <li>Копируем код: <Button @click="copyCode">{{ copyCodeText }}</Button></li>
      <li>Вставляем код в редактор, удаляя пустую функцию по умолчанию</li>
      <li>Нажимаем сверху кнопку &#128073;Начать развертывание</li>
      <li>&#128073;Новое развертывание</li>
      <li>Выберите тип, нажимаем шестеренку, выбираем &#128073;Веб-приложение</li>
      <li>У кого есть доступ, ставим - &#128073;Все</li>
      <li>Предоставить доступ, дальше авторизация через гугл</li>
      <li>‼️На странице с восклицательным знаком - &#128073;Advanced &#128073;Go to ... (unsafe)</li>
      <li>Копируем URL</li>
      <li>Вставляем в поле &#128073;Url до api с личными доступами&#128072; на предыдущем экране или в разделе настроек
        в
        дальнейшем</li>
    </ol>
  </Content>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Button from '@/components/ui/Button.vue'
import Content from '@/components/Content.vue'

defineEmits(['return'])

const copyCodeText = ref('Скопировать код')

const copyCode = () => {
  navigator.clipboard.writeText(
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
`
  )
    .then(() => {
      copyCodeText.value = 'Скопировано!';
      setTimeout(() => {
        copyCodeText.value = 'Скопировать код';
      }, 1500);
    })
}
</script>

<style lang="scss">
.instruction-page {
  padding: 10px;
}
</style>
<script setup>
import InstructionTopic from './InstructionTopic.vue'
</script>

<template>
    <div class="grid max-w-3xl gap-8 text-[13px] leading-relaxed text-ui-text">
        <section aria-labelledby="instructions-title" class="grid gap-3">
            <h1 id="instructions-title" class="ui-title">Инструкции</h1>
            <InstructionTopic title="Ограничение поддоменов">
                <p>В таблице проектов или доступов добавьте <code class="text-ui-text">!</code> перед адресом сайта, чтобы запись действовала только на указанный хост.</p>
                <p>Например, <code class="break-all text-ui-text">!https://example.org</code> действует на example.org, но не на www.example.org и другие поддомены. Без <code class="text-ui-text">!</code> поддомены тоже учитываются.</p>
                <p>Проекты и доступы настраиваются независимо. После изменения таблицы обновите соответствующие данные API в настройках расширения.</p>
            </InstructionTopic>
            <InstructionTopic title="Фоновая работа">
                <p>Раз в сутки проверяет новые версии на GitHub. Дата проверки и скачивание пакета — в «Настройки» → «Обновления».</p>
                <p>Расширение раз в неделю обновляет данные из настроенных API и загружает иконки сайтов.</p>
                <p>На support.5th.ru локально учитывает время работы с тикетом; при бездействии блокирует защищённые доступы.</p>
                <p>SEO-проверки запускаются при открытии SEO, счётчик Яндекса — по кнопке «Получить» с передачей домена сайта.</p>
            </InstructionTopic>
        </section>
    </div>
</template>

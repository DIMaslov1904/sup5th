<script setup>
import Input from './ui/Input.vue'

const value = defineModel({ type: String, required: true })
defineProps({ connected: Boolean, disabled: Boolean })
</script>

<template>
    <label class="grid gap-1.5 text-xs text-ui-muted">
        Строка подключения
        <Input v-model="value" type="password" autocomplete="off" :required="!connected" :disabled="disabled"
            :placeholder="connected ? 'Подключение сохранено' : 'Вставьте строку подключения'" />
    </label>
    <p class="text-xs text-ui-muted">Скопируйте строку из раздела «Мой профиль» → «SUP 5th» в панели.</p>
</template>

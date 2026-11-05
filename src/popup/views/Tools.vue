<script setup>
import { onMounted, reactive, ref, watch } from 'vue'
import { generatePassword } from '../../utils/passwordGenerator.js'
import Button from '../components/ui/Button.vue'
import Input from '../components/ui/Input.vue'
import Select from '../components/ui/Select.vue'
import Card from '../components/ui/Card.vue'
import Notification from '../components/ui/Notification.vue'
import CopyButton from '../components/ui/CopyButton.vue'
const password = ref(''), error = ref('')
const options = reactive({ length: 20, alphabet: 'latin', lower: true, upper: true, digits: true, special: true, separators: true })
const generate = () => {
    error.value = ''
    try { password.value = generatePassword({ ...options, length: Number(options.length) }) }
    catch (reason) { password.value = ''; error.value = reason.message }
}
watch(options, generate)
onMounted(generate)
</script>
<template>
    <section class="grid gap-4 px-4">
        <Card title="Генератор паролей"><div class="grid gap-3"><textarea :value="password" readonly aria-label="Сгенерированный пароль" rows="3" class="w-full resize-none rounded-control border border-ui-border bg-ui-field p-3 font-mono text-sm wrap-anywhere text-ui-text" @focus="$event.target.select()"></textarea><div class="flex gap-2"><Button variant="secondary" size="sm" @click="generate">Сгенерировать ещё</Button><CopyButton :value="password" :disabled="!password" /></div></div></Card>
        <Card title="Параметры"><div class="grid gap-4">
            <label class="grid gap-1 text-xs text-ui-muted">Количество символов<Input v-model="options.length" type="number" min="4" max="256" step="1" /></label>
            <label class="grid gap-1 text-xs text-ui-muted">Алфавит<Select v-model="options.alphabet"><option value="latin">Только латиница</option><option value="cyrillic">Только кириллица</option><option value="mixed">Латиница и кириллица</option></Select></label>
            <div class="grid grid-cols-2 gap-3 text-xs"><label class="flex items-center gap-2"><input v-model="options.lower" type="checkbox" class="accent-ui-accent" />Строчные буквы</label><label class="flex items-center gap-2"><input v-model="options.upper" type="checkbox" class="accent-ui-accent" />Прописные буквы</label><label class="flex items-center gap-2"><input v-model="options.digits" type="checkbox" class="accent-ui-accent" />Цифры</label><label class="flex items-center gap-2"><input v-model="options.special" type="checkbox" class="accent-ui-accent" />Спецсимволы</label></div>
            <label class="flex items-center gap-2 text-xs"><input v-model="options.separators" type="checkbox" class="accent-ui-accent" />Разделители</label>
        </div></Card>
        <Notification v-if="error" :text="error" />
    </section>
</template>

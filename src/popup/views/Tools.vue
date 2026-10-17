<script setup>
import { onMounted, reactive, ref, watch } from 'vue'
import { generatePassword } from '../../utils/passwordGenerator.js'
import Button from '../components/ui/Button.vue'
import Input from '../components/ui/Input.vue'
import Select from '../components/ui/Select.vue'
import Card from '../components/ui/Card.vue'
import Notification from '../components/ui/Notification.vue'
const selected = ref(''), password = ref(''), error = ref(''), copied = ref(false)
const options = reactive({ length: 20, alphabet: 'latin', lower: true, upper: true, digits: true, special: true, separators: true })
const generate = () => {
    copied.value = false; error.value = ''
    try { password.value = generatePassword({ ...options, length: Number(options.length) }) }
    catch (reason) { password.value = ''; error.value = reason.message }
}
const copy = async () => { try { await navigator.clipboard.writeText(password.value); copied.value = true } catch (reason) { error.value = reason.message } }
watch(options, generate)
onMounted(generate)
</script>
<template>
    <section class="grid gap-4 px-4">
        <template v-if="!selected"><h1 class="ui-title">Инструменты</h1><button type="button" class="ui-panel flex items-center gap-3 text-left transition-colors hover:border-ui-accent/50" @click="selected = 'password'"><span aria-hidden="true" class="grid size-10 place-items-center rounded-control bg-ui-accent/10 text-xl text-ui-accent">✱</span><span><strong class="block text-[13px]">Генератор паролей</strong><span class="text-xs text-ui-muted">Длина, алфавит, символы и разделители</span></span><span class="ml-auto text-ui-muted" aria-hidden="true">→</span></button></template>
        <template v-else>
            <div class="flex items-center gap-2"><Button size="sm" variant="ghost" aria-label="Назад к инструментам" @click="selected = ''">←</Button><h1 class="ui-title">Генератор паролей</h1></div>
            <Card title="Новый пароль"><div class="grid gap-3"><textarea :value="password" readonly aria-label="Сгенерированный пароль" rows="3" class="w-full resize-none rounded-control border border-ui-border bg-ui-field p-3 font-mono text-sm wrap-anywhere text-ui-text" @focus="$event.target.select()"></textarea><div class="flex gap-2"><Button variant="secondary" size="sm" @click="generate">Сгенерировать ещё</Button><Button size="sm" :disabled="!password" @click="copy">{{ copied ? 'Скопирован' : 'Скопировать' }}</Button></div></div></Card>
            <Card title="Параметры"><div class="grid gap-4">
                <label class="grid gap-1 text-xs text-ui-muted">Количество символов<Input v-model="options.length" type="number" min="4" max="256" step="1" /></label>
                <label class="grid gap-1 text-xs text-ui-muted">Алфавит<Select v-model="options.alphabet"><option value="latin">Только латиница</option><option value="cyrillic">Только кириллица</option><option value="mixed">Латиница и кириллица</option></Select></label>
                <div class="grid grid-cols-2 gap-3 text-xs"><label class="flex items-center gap-2"><input v-model="options.lower" type="checkbox" class="accent-ui-accent" />Строчные буквы</label><label class="flex items-center gap-2"><input v-model="options.upper" type="checkbox" class="accent-ui-accent" />Прописные буквы</label><label class="flex items-center gap-2"><input v-model="options.digits" type="checkbox" class="accent-ui-accent" />Цифры</label><label class="flex items-center gap-2"><input v-model="options.special" type="checkbox" class="accent-ui-accent" />Спецсимволы</label></div>
                <label class="flex items-center gap-2 text-xs"><input v-model="options.separators" type="checkbox" class="accent-ui-accent" />Разделители</label>
            </div></Card>
            <Notification v-if="error" :text="error" />
        </template>
    </section>
</template>

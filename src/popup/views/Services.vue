<script setup>
import { onMounted, ref } from 'vue'
import { loadServices, saveServices } from '../data/projectData'
import Button from '../components/ui/Button.vue'
import Input from '../components/ui/Input.vue'
import Message from '../components/ui/Message.vue'

const services = ref([])
const showForm = ref(false)
const editingId = ref('')
const saving = ref(false)
const message = ref({ type: 'error', text: '' })
const draggedId = ref('')
const dragMoved = ref(false)
const openMenuId = ref('')
const form = ref({ name: '', url: '', login: '', password: '' })

onMounted(async () => {
    try {
        services.value = await loadServices()
    } catch (error) {
        message.value = { type: 'error', text: error.message }
    }
})

const resetForm = () => {
    form.value = { name: '', url: '', login: '', password: '' }
    editingId.value = ''
    showForm.value = false
}

const beginEdit = (service) => {
    editingId.value = service.id
    form.value = { name: service.name, url: service.url, login: service.login, password: service.password }
    showForm.value = true
    openMenuId.value = ''
}

const saveService = async () => {
    message.value = { type: 'error', text: '' }
    saving.value = true
    try {
        const updatedServices = editingId.value
            ? services.value.map((service) => service.id === editingId.value ? { ...form.value, id: service.id } : service)
            : [...services.value, { ...form.value }]
        services.value = await saveServices(updatedServices)
        resetForm()
    } catch (error) {
        message.value = { type: 'error', text: error.message }
    } finally {
        saving.value = false
    }
}

const removeService = async (id) => {
    try {
        services.value = await saveServices(services.value.filter((service) => service.id !== id))
        openMenuId.value = ''
        if (editingId.value === id) resetForm()
    } catch (error) {
        message.value = { type: 'error', text: error.message }
    }
}

const copyValue = async (value, label) => {
    if (!value) return
    try {
        await navigator.clipboard.writeText(value)
        message.value = { type: 'success', text: `${label} скопирован` }
        window.setTimeout(() => {
            if (message.value.text === `${label} скопирован`) message.value = { type: 'error', text: '' }
        }, 1500)
    } catch {
        message.value = { type: 'error', text: 'Не удалось скопировать в буфер обмена' }
    }
}

const onDragOver = (event, targetId) => {
    if (!draggedId.value || draggedId.value === targetId) return
    event.dataTransfer.dropEffect = 'move'
    const target = event.currentTarget
    const placeAfter = event.clientY > target.getBoundingClientRect().top + target.offsetHeight / 2
    const reordered = [...services.value]
    const from = reordered.findIndex((service) => service.id === draggedId.value)
    if (from < 0) return
    const [moved] = reordered.splice(from, 1)
    const targetIndex = reordered.findIndex((service) => service.id === targetId)
    if (targetIndex < 0) return
    const insertAt = targetIndex + (placeAfter ? 1 : 0)
    if (from === insertAt) return
    reordered.splice(insertAt, 0, moved)
    services.value = reordered
    dragMoved.value = true
}

const finishDrag = async () => {
    if (!draggedId.value) return
    draggedId.value = ''
    if (!dragMoved.value) return
    dragMoved.value = false
    try {
        services.value = await saveServices(services.value)
    } catch (error) {
        message.value = { type: 'error', text: error.message }
    }
}
</script>

<template>
    <section class="w-full px-4 text-slate-200">
        <header class="mb-4 flex items-center justify-between gap-3">
            <Button variant="secondary" size="sm" @click="showForm ? resetForm() : (showForm = true)">
                {{ showForm ? 'Закрыть' : 'Добавить' }}
            </Button>
        </header>

        <form v-if="showForm" class="mb-4 grid gap-3 rounded-lg border border-white/10 bg-slate-900/50 p-3"
            @submit.prevent="saveService">
            <h2 class="text-sm font-semibold">{{ editingId ? 'Редактирование' : 'Новый элемент' }}</h2>
            <Input v-model="form.name" required placeholder="Название" />
            <Input v-model="form.url" required type="url" placeholder="https://example.com" />
            <Input v-model="form.login" autocomplete="username" placeholder="Логин" />
            <Input v-model="form.password" type="password" autocomplete="new-password" placeholder="Пароль" />
            <Button type="submit" :disabled="saving">{{ saving ? 'Сохраняю...' : editingId ? 'Сохранить' : 'Добавить' }}</Button>
            <Button variant="ghost" size="sm" @click="resetForm">Отмена</Button>
        </form>

        <p v-if="!services.length && !showForm" class="text-sm text-slate-400">Пока нет сохранённых сервисов</p>
        <div v-else class="flex flex-col gap-2">
            <article v-for="service in services" :key="service.id" draggable="true"
                class="active:cursor-grabbing relative flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900/40 p-3 transition-[transform,opacity]"
                :class="draggedId === service.id ? 'opacity-40' : ''"
                @dragstart="draggedId = service.id; dragMoved = false" @dragover.prevent="onDragOver($event, service.id)"
                @drop.prevent="finishDrag" @dragend="finishDrag">
                <span class="cursor-grab active:cursor-grabbing select-none px-1 text-slate-500" title="Перетащить для сортировки">⠿</span>
                <a :href="service.url" target="_blank" rel="noreferrer"
                    class="flex min-w-0 flex-1 flex-col text-slate-100 hover:text-sky-300">
                    <span class="text-sm font-medium">{{ service.name }}</span>
                    <span class="max-w-full line-clamp-1 text-[11px] text-slate-500">{{ service.url }}</span>
                </a>
                <Button v-if="service.login" variant="ghost" size="sm" title="Скопировать логин"
                    aria-label="Скопировать логин" @click="copyValue(service.login, 'Логин')">Логин</Button>
                <Button v-if="service.password" variant="ghost" size="sm" title="Скопировать пароль"
                    aria-label="Скопировать пароль" @click="copyValue(service.password, 'Пароль')">Пароль</Button>
                <button type="button" title="Действия сервиса" :aria-label="`Действия: ${service.name}`"
                    @click.stop="openMenuId = openMenuId === service.id ? '' : service.id"
                    class="rounded px-2 py-1 text-lg leading-none text-slate-400 hover:bg-white/10 hover:text-white cursor-pointer">
                    ⋮
                </button>
                <div v-if="openMenuId === service.id" class="absolute right-2 top-11 z-20 grid min-w-32 gap-1 rounded border border-white/10 bg-slate-800 p-1 shadow-lg">
                    <button type="button" class="rounded px-3 py-2 text-left text-xs hover:bg-white/10 cursor-pointer" @click="beginEdit(service)">Редактировать</button>
                    <button type="button" class="rounded px-3 py-2 text-left text-xs text-red-300 hover:bg-red-400/10 cursor-pointer" @click="removeService(service.id)">Удалить</button>
                </div>
            </article>
        </div>
        <Message v-if="message.text" :type="message.type">{{ message.text }}</Message>
    </section>
</template>

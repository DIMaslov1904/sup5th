<script setup>
import { onMounted, ref } from 'vue'
import { getServiceField, loadServices } from '../data/projectData'
import { ensureUnlocked } from '../unlockStore'
import Button from '../components/ui/Button.vue'
import Message from '../components/ui/Message.vue'

const services = ref([])
const loaded = ref(false)
const copying = ref('')
const message = ref({ type: 'error', text: '' })

onMounted(async () => {
    try {
        services.value = await loadServices()
    } catch (error) {
        message.value = { type: 'error', text: error.message }
    } finally {
        loaded.value = true
    }
})

const copyField = async (service, field) => {
    copying.value = `${service.id}:${field}`
    const label = field === 'login' ? 'Логин' : 'Пароль'
    try {
        const value = await ensureUnlocked(() => getServiceField(service.id, field))
        await navigator.clipboard.writeText(value)
        message.value = { type: 'success', text: `${label} скопирован` }
        window.setTimeout(() => {
            if (message.value.text === `${label} скопирован`) message.value = { type: 'error', text: '' }
        }, 1500)
    } catch (error) {
        message.value = { type: 'error', text: error.message || 'Не удалось скопировать в буфер обмена' }
    } finally {
        copying.value = ''
    }
}
</script>

<template>
    <section class="w-full px-4 text-slate-200">
        <p v-if="!loaded" class="text-sm text-slate-400">Загрузка...</p>
        <p v-else-if="!services.length" class="text-sm text-slate-400">В API нет сервисов или данные ещё не загружены</p>
        <div v-else class="flex flex-col gap-2">
            <article v-for="service in services" :key="service.id"
                class="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900/40 p-3">
                <a :href="service.url" target="_blank" rel="noreferrer"
                    class="flex min-w-0 flex-1 flex-col text-slate-100 hover:text-sky-300">
                    <span class="text-sm font-medium">{{ service.name }}</span>
                    <span class="max-w-full line-clamp-1 text-[11px] text-slate-500">{{ service.url }}</span>
                </a>
                <Button v-if="service.login || service.hasLogin" variant="ghost" size="sm" title="Скопировать логин"
                    aria-label="Скопировать логин" :disabled="Boolean(copying)" @click="copyField(service, 'login')">Логин</Button>
                <Button v-if="service.password || service.hasPassword" variant="ghost" size="sm" title="Скопировать пароль"
                    aria-label="Скопировать пароль" :disabled="Boolean(copying)" @click="copyField(service, 'password')">Пароль</Button>
            </article>
        </div>
        <Message v-if="message.text" :type="message.type">{{ message.text }}</Message>
    </section>
</template>

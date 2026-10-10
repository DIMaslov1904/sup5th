<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { ensureUnlocked } from '../unlockStore'
import { getProjectAccessField } from '../data/projectData'
import { getSshCommand } from '../../utils/ssh.js'
import Message from './ui/Message.vue'

const props = defineProps({ access: Object, projectUrl: String, index: Number })
const menu = ref(null), copying = ref(false), message = ref(''), error = ref(false)
const closeOutside = event => { if (menu.value && !menu.value.contains(event.target)) menu.value.open = false }
onMounted(() => document.addEventListener('pointerdown', closeOutside))
onUnmounted(() => document.removeEventListener('pointerdown', closeOutside))
const copy = async (field) => {
    copying.value = true
    menu.value.open = false
    try {
        const value = await ensureUnlocked(async () => {
            if (field !== 'ssh') return getProjectAccessField(props.projectUrl, props.index, field)
            const [host, login] = await Promise.all(['ftpUrl', 'ftpLogin'].map(name => getProjectAccessField(props.projectUrl, props.index, name)))
            return getSshCommand(login, host)
        })
        await navigator.clipboard.writeText(value)
        error.value = false
        message.value = `${{ ftpUrl: 'Host', ftpLogin: 'Логин', ftpPassword: 'Пароль', ssh: 'SSH-команда' }[field]} скопирован${field === 'ssh' ? 'а' : ''}`
    } catch (e) { error.value = true; message.value = e.message }
    finally { copying.value = false }
}
</script>
<template>
    <article class="relative rounded-lg border border-white/10 bg-slate-900/40 p-3">
        <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 text-xs">
                <p class="break-all font-medium text-slate-200">{{ access.ftpUrl || 'FTP / SSH host' }}</p>
                <p class="mt-1 text-slate-400">Логин: {{ access.ftpLogin || (access.ftpHasLogin ? 'Скрыт' : 'Не указан') }}</p>
            </div>
            <details ref="menu" class="relative shrink-0" @keydown.esc="menu.open = false">
                <summary class="cursor-pointer list-none rounded px-2 py-1 text-lg leading-none hover:bg-white/10" aria-label="Действия FTP" title="Действия FTP">⋮</summary>
                <div class="absolute right-0 top-8 z-20 grid min-w-44 rounded-lg border border-white/10 bg-slate-800 p-1 shadow-xl">
                    <button v-for="item in [['ftpUrl', 'Скопировать host', true], ['ftpLogin', 'Скопировать логин', access.ftpHasLogin], ['ftpPassword', 'Скопировать пароль', access.ftpHasPassword], ['ssh', 'Скопировать SSH', access.ftpHasLogin]]"
                        v-show="item[2]" :key="item[0]" :disabled="copying" @click="copy(item[0])" class="cursor-pointer rounded px-3 py-2 text-left text-xs hover:bg-white/10 disabled:opacity-50">{{ item[1] }}</button>
                </div>
            </details>
        </div>
        <Message v-if="message" :type="error ? 'error' : 'success'">{{ message }}</Message>
    </article>
</template>

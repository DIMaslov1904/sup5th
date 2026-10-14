<script setup>
import { ref } from 'vue'
import { ensureUnlocked } from '../unlockStore'
import { getProjectAccessField, getProjectAccessText, startAdminAuth } from '../data/projectData'
import { getAdminUrl } from '../../utils/projectUtils'
import CredentialCard from './CredentialCard.vue'
import Button from './ui/Button.vue'

const props = defineProps({ access: Object, project: Object, index: Number })
const card = ref(null), busy = ref(''), message = ref(''), error = ref(false)
const run = async (kind, action, success = '') => {
    if (busy.value) return
    card.value?.close(); busy.value = kind; message.value = ''; error.value = false
    try { await action(); message.value = success }
    catch (reason) { error.value = true; message.value = reason.message }
    finally { busy.value = '' }
}
const copy = field => run(field, async () => {
    const value = await ensureUnlocked(() => field === 'text'
        ? getProjectAccessText(props.project.url, props.index)
        : getProjectAccessField(props.project.url, props.index, field))
    await navigator.clipboard.writeText(value)
}, `${{ login: 'Логин', password: 'Пароль', text: 'Доступ' }[field]} скопирован`)
const login = () => run('login-admin', () => ensureUnlocked(() => startAdminAuth(props.project.url, props.index)))
</script>
<template>
    <CredentialCard ref="card" :title="access.login || `Доступ ${index + 1}`" :menu-label="`Действия: ${access.login || index + 1}`" :message="message" :error="error">
        <template #quick>
            <Button v-if="access.hasLogin && access.hasPassword" size="sm" :disabled="Boolean(busy) || !getAdminUrl(project)" :title="`Войти как ${access.login || index + 1}`" @click="login">{{ busy === 'login-admin' ? 'Вход…' : 'Войти' }}</Button>
        </template>
        <template #menu>
            <button v-for="item in [['login', 'Скопировать логин', access.hasLogin], ['password', 'Скопировать пароль', access.hasPassword], ['text', 'Скопировать доступ', access.hasLogin && access.hasPassword]]"
                v-show="item[2]" :key="item[0]" type="button" :disabled="Boolean(busy)" class="ui-menu-item" @click="copy(item[0])">{{ item[1] }}</button>
            <span v-if="!access.hasLogin && !access.hasPassword" class="px-3 py-2 text-xs text-ui-muted">Логин и пароль не указаны</span>
        </template>
    </CredentialCard>
</template>

<script setup>
import { ref } from 'vue'
import { ensureUnlocked, copyUnlockedText } from '../unlockStore'
import { getProjectAccessField, getProjectAccessText, startAdminAuth } from '../data/projectData'
import { getAdminUrl } from '../../utils/projectUtils'
import { useCardAction } from '../useCardAction.js'
import CredentialCard from './CredentialCard.vue'
import Button from './ui/Button.vue'

const props = defineProps({ access: Object, project: Object, index: Number })
const card = ref(null)
const { busy, message, error, run } = useCardAction(card)
const copy = field => run(async () => {
    await copyUnlockedText(() => field === 'text'
        ? getProjectAccessText(props.project.url, props.access.id)
        : getProjectAccessField(props.project.url, props.access.id, field), { intent: { type: 'project-copy', url: props.project.url, accessId: props.access.id, field } })
}, `${{ login: 'Логин', password: 'Пароль', text: 'Доступ' }[field]} скопирован`)
const login = () => run(() => ensureUnlocked(() => startAdminAuth(props.project.url, props.access.id), { refreshAfterUnlock: false, intent: { type: 'auth', url: props.project.url, accessId: props.access.id } }))
</script>
<template>
    <CredentialCard ref="card" :title="access.login || `Доступ ${index + 1}`" :menu-label="`Действия: ${access.login || index + 1}`" :message="message" :error="error">
        <template #quick>
            <Button v-if="access.hasLogin && access.hasPassword" size="sm" :disabled="busy || !getAdminUrl(project)" :title="`Войти как ${access.login || index + 1}`" @click="login">{{ busy ? 'Вход…' : 'Войти' }}</Button>
        </template>
        <template #menu>
            <button v-for="item in [['login', 'Скопировать логин', access.hasLogin], ['password', 'Скопировать пароль', access.hasPassword], ['text', 'Скопировать доступ', access.hasLogin && access.hasPassword]]"
                v-show="item[2]" :key="item[0]" type="button" :disabled="busy" class="ui-menu-item" @click="copy(item[0])">{{ item[1] }}</button>
            <span v-if="!access.hasLogin && !access.hasPassword" class="px-3 py-2 text-xs text-ui-muted">Логин и пароль не указаны</span>
        </template>
    </CredentialCard>
</template>

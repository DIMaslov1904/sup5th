<script setup>
import { ref } from 'vue'
import { copyUnlockedText } from '../unlockStore'
import { getProjectAccessField } from '../data/projectData'
import { getSshCommand } from '../../utils/ssh.js'
import CredentialCard from './CredentialCard.vue'

const props = defineProps({ access: Object, projectUrl: String, index: Number })
const card = ref(null), copying = ref(false), message = ref(''), error = ref(false)
const copy = async field => {
    if (copying.value) return
    copying.value = true; card.value?.close(); message.value = ''
    try {
        await copyUnlockedText(async () => {
            if (field !== 'ssh') return getProjectAccessField(props.projectUrl, props.access.id, field)
            const [host, login] = await Promise.all(['ftpUrl', 'ftpLogin'].map(name => getProjectAccessField(props.projectUrl, props.access.id, name)))
            return getSshCommand(login, host)
        }, { intent: { type: 'project-copy', url: props.projectUrl, accessId: props.access.id, field } })
        error.value = false
        message.value = `${{ ftpUrl: 'Host', ftpLogin: 'Логин', ftpPassword: 'Пароль', ssh: 'SSH-команда' }[field]} скопирован${field === 'ssh' ? 'а' : ''}`
    } catch (reason) { error.value = true; message.value = reason.message }
    finally { copying.value = false }
}
</script>
<template>
    <CredentialCard ref="card" :title="access.ftpUrl || 'Host не указан'" menu-label="Действия FTP" :message="message" :error="error">
        <template #menu>
            <button v-for="item in [['ftpUrl', 'Скопировать host', Boolean(access.ftpUrl)], ['ftpLogin', 'Скопировать логин', access.ftpHasLogin], ['ftpPassword', 'Скопировать пароль', access.ftpHasPassword], ['ssh', 'Скопировать SSH', access.ftpHasLogin && Boolean(access.ftpUrl)]]"
                v-show="item[2]" :key="item[0]" type="button" :disabled="copying" @click="copy(item[0])" class="ui-menu-item">{{ item[1] }}</button>
        </template>
    </CredentialCard>
</template>

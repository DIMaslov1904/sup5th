<script setup>
import Tabs from './ui/Tabs.vue'
import Input from './ui/Input.vue'
import Button from './ui/Button.vue'
import BiometricProviderHelp from './BiometricProviderHelp.vue'

defineProps({
    tab: { type: String, required: true },
    pin: { type: String, default: '' },
    tabs: { type: Array, required: true },
    disabled: Boolean,
    loading: Boolean,
    biometricLabel: { type: String, default: 'Настроить биометрию' },
    biometricVariant: { type: String, default: 'primary' }
})
const emit = defineEmits(['update:tab', 'update:pin', 'enable', 'enable-pin'])
</script>
<template>
    <Tabs :model-value="tab" :items="tabs" label="Способ защиты" wrap @update:model-value="emit('update:tab', $event)" />
    <template v-if="tab === 'biometric'">
        <Button :variant="biometricVariant" :disabled="disabled" :loading="loading" @click="emit('enable')">{{ biometricLabel }}</Button>
        <BiometricProviderHelp />
    </template>
    <form v-else class="grid gap-2" @submit.prevent="emit('enable-pin')">
        <Input :model-value="pin" type="password" maxlength="6" autocomplete="off" spellcheck="false" placeholder="PIN-код · 6 символов" :disabled="disabled || loading" @update:model-value="emit('update:pin', $event)" />
        <Button type="submit" variant="secondary" :loading="loading" :disabled="disabled || pin.length !== 6">Включить PIN-код</Button>
    </form>
</template>

<script setup>
import { ref, watch } from 'vue'
import Message from './Message.vue'
const props = defineProps({ text: { type: String, required: true }, type: { type: String, default: 'error' } })
const dismissed = ref(false)
watch(() => [props.text, props.type], () => { dismissed.value = false })
</script>
<template>
    <Teleport defer to="#notifications">
        <div v-if="text && !dismissed" class="pointer-events-auto relative shrink-0 rounded-panel bg-ui-panel text-ui-text shadow-xl">
            <Message :type="type" class="m-0! wrap-anywhere whitespace-pre-line pr-10">{{ text }}</Message>
            <button type="button" aria-label="Закрыть уведомление" title="Закрыть уведомление" class="ui-icon-button absolute top-1 right-1 size-7" @click="dismissed = true">×</button>
        </div>
    </Teleport>
</template>

<script setup>
import { ref } from 'vue'
import Notification from './ui/Notification.vue'
import ActionMenu from './ui/ActionMenu.vue'
import CopyFeedback from './ui/CopyFeedback.vue'

defineProps({ title: String, menuLabel: String, message: String, error: Boolean })
const menu = ref(null)
const close = () => menu.value?.close()
defineExpose({ close })
</script>
<template>
    <article class="ui-panel relative">
        <div class="flex items-center justify-between gap-3">
            <span class="min-w-0 break-all text-xs text-ui-muted">{{ title }}</span>
            <div class="flex shrink-0 items-center gap-2">
                <CopyFeedback v-if="!error" :text="message" />
                <slot name="quick" />
                <ActionMenu ref="menu" :label="menuLabel"><slot name="menu" /></ActionMenu>
            </div>
        </div>
        <Notification v-if="message && error" :text="message" />
    </article>
</template>

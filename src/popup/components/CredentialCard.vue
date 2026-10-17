<script setup>
import { ref } from 'vue'
import Notification from './ui/Notification.vue'
import ActionMenu from './ui/ActionMenu.vue'

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
                <slot name="quick" />
                <ActionMenu ref="menu" :label="menuLabel"><slot name="menu" /></ActionMenu>
            </div>
        </div>
        <Notification v-if="message" :type="error ? 'error' : 'success'" :text="message" />
    </article>
</template>

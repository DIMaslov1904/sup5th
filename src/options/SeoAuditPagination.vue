<script setup>
import { nextTick } from 'vue'
import Button from '../popup/components/ui/Button.vue'
import Select from '../popup/components/ui/Select.vue'

const page = defineModel('page', { type: Number, required: true })
const pageSize = defineModel('pageSize', { type: Number })
const props = defineProps({ count: Number, label: String, sizeLabel: String, jump: Boolean, scrollTarget: Object })
const goToPage = async value => {
    page.value = value
    if (!props.scrollTarget) return
    await nextTick()
    props.scrollTarget?.focus({ preventScroll: true })
    props.scrollTarget?.scrollIntoView({ block: 'start', inline: 'nearest' })
}
</script>
<template>
    <nav class="flex flex-wrap items-center gap-2 text-xs" :class="{ 'justify-between': pageSize !== undefined }" :aria-label="label">
        <label v-if="pageSize !== undefined" class="flex items-center gap-2 text-ui-muted">
            На странице
            <Select v-model="pageSize" :aria-label="sizeLabel" class="w-20">
                <option :value="25">25</option>
                <option :value="50">50</option>
                <option :value="100">100</option>
            </Select>
        </label>
        <div class="flex flex-wrap items-center gap-2">
            <Button v-if="jump" variant="secondary" size="sm" :disabled="page === 1" aria-label="Первая страница результатов" @click="goToPage(1)">«</Button>
            <Button variant="secondary" size="sm" :disabled="page === 1" @click="goToPage(page - 1)">Назад</Button>
            <span>{{ page }} / {{ count }}</span>
            <Button variant="secondary" size="sm" :disabled="page === count" @click="goToPage(page + 1)">Далее</Button>
            <Button v-if="jump" variant="secondary" size="sm" :disabled="page === count" aria-label="Последняя страница результатов" @click="goToPage(count)">»</Button>
        </div>
    </nav>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import Button from './ui/Button.vue'
import { useColorScheme } from '../useColorScheme.js'
import { yandexCounterUrl } from '../../utils/yandexCounter.js'

const props = defineProps({ pageUrl: { type: String, required: true } })
const theme = useColorScheme()
const requestedUrl = ref(''), failed = ref(false)
const imageUrl = computed(() => requestedUrl.value && requestedUrl.value === props.pageUrl
    ? yandexCounterUrl(props.pageUrl, theme.value) : '')

watch(() => props.pageUrl, () => { requestedUrl.value = ''; failed.value = false }, { flush: 'sync' })
const load = () => { failed.value = false; requestedUrl.value = props.pageUrl }
const fail = event => {
    if (event.target.getAttribute('src') !== imageUrl.value) return
    requestedUrl.value = ''; failed.value = true
}
</script>

<template>
    <div class="grid justify-items-start text-xs">
        <img v-if="imageUrl" :key="imageUrl" :src="imageUrl" alt="Яндекс ИКС" referrerpolicy="no-referrer" class="rounded-lg" @error="fail" />
        <template v-else>
            <Button size="sm" variant="secondary" :title="failed ? 'Не удалось загрузить счётчик. Нажмите, чтобы повторить.' : undefined" @click="load">Получить</Button>
        </template>
    </div>
</template>

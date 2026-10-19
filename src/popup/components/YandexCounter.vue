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
    <div class="mt-3 grid justify-items-start gap-1 text-xs">
        <span class="text-ui-muted/70">Яндекс ИКС</span>
        <img v-if="imageUrl" :key="imageUrl" :src="imageUrl" alt="Яндекс ИКС" referrerpolicy="no-referrer" class="rounded-lg" @error="fail" />
        <template v-else>
            <Button size="sm" variant="secondary" @click="load">{{ failed ? 'Повторить' : 'Получить' }}</Button>
            <span v-if="failed" role="status" class="text-ui-muted">Не удалось загрузить счётчик.</span>
            <span class="text-ui-muted">При нажатии домен сайта передаётся Яндексу.</span>
        </template>
    </div>
</template>

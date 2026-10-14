<script setup>
import { computed, ref, watch } from 'vue'
import { buildOpenGraphPreview } from '../../utils/openGraphPreview.js'
import Modal from './ui/Modal.vue'

const open = defineModel('open', { type: Boolean, default: false })
const props = defineProps({ report: { type: Object, required: true } })
const preview = computed(() => buildOpenGraphPreview(props.report))
const failedImage = ref(false)
watch([open, () => preview.value.image], () => { failedImage.value = false })
const variants = [['max', 'MAX'], ['vk', 'VK'], ['telegram', 'Telegram — большая карточка'], ['telegram-small', 'Telegram — компактная карточка']]
</script>

<template>
    <Modal v-model:open="open" title="Предпросмотр Open Graph" fullscreen>
        <div v-if="open" class="mx-auto grid min-w-0 w-full max-w-5xl gap-4">
            <p v-if="!preview.hasOg" class="text-xs text-ui-muted">Open Graph в head не задан. Используем Title и Description страницы.</p>
            <div class="grid min-w-0 items-start gap-4 min-[720px]:grid-cols-2">
            <section v-for="[kind,label] in variants" :key="kind" class="grid min-w-0 gap-2" :aria-label="`Превью ${label}`">
                <h3 class="text-[13px] font-medium text-ui-muted">{{ label }}</h3>
                <article class="min-w-0 overflow-hidden rounded-panel border border-slate-200 bg-white text-slate-900"
                    :class="[kind === 'telegram-small' ? 'grid grid-cols-[minmax(0,1fr)_80px] gap-3 p-3' : 'flex flex-col', kind.startsWith('telegram') ? 'border-l-4 border-l-sky-500' : kind === 'max' ? 'rounded-2xl border-indigo-200' : '']">
                    <div class="flex items-center justify-center overflow-hidden bg-slate-100 text-slate-400"
                        :class="kind === 'telegram-small' ? 'order-2 size-20 self-start rounded-control' : kind === 'telegram' ? 'order-2 aspect-[1.91/1]' : 'aspect-[1.91/1] border-b border-slate-200'">
                        <img v-if="preview.image && !failedImage" :src="preview.image" :alt="preview.imageAlt" referrerpolicy="no-referrer" class="h-full w-full object-cover" @error="failedImage = true" />
                        <span v-else class="grid justify-items-center gap-2 px-2 text-center text-[11px] leading-4">
                            <svg class="size-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8" cy="8" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>
                            {{ failedImage ? 'Изображение не загрузилось' : 'Нет доступного og:image' }}
                        </span>
                    </div>
                    <div class="grid min-w-0 content-start gap-1" :class="kind === 'telegram-small' ? '' : kind === 'vk' ? 'bg-slate-50 p-3' : 'p-3'">
                        <span v-if="kind !== 'vk'" class="truncate text-xs font-semibold" :class="kind === 'max' ? 'text-indigo-600' : 'text-sky-700'">{{ preview.siteName }}</span>
                        <h4 class="line-clamp-2 wrap-anywhere text-[13px] font-semibold leading-5" :class="kind === 'vk' ? 'text-sky-800' : ''">{{ preview.title }}</h4>
                        <p v-if="kind !== 'vk' && preview.description" class="line-clamp-3 wrap-anywhere text-xs leading-5 text-slate-600">{{ preview.description }}</p>
                        <span class="truncate text-[11px] text-slate-500">{{ preview.domain }}</span>
                    </div>
                </article>
            </section>
            </div>
            <p class="text-[11px] leading-4 text-ui-muted">Примерное отображение: сервисы могут иначе обрезать текст и изображение и кешировать превью.</p>
        </div>
    </Modal>
</template>

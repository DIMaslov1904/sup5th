<script setup>
import { computed, ref } from 'vue'
import { paginateAuditResults } from '../utils/seoAuditResults.js'
import Card from '../popup/components/ui/Card.vue'
import Button from '../popup/components/ui/Button.vue'
import SeoAuditSources from './SeoAuditSources.vue'
import SeoAuditInfo from './SeoAuditInfo.vue'
const props = defineProps({ exclusions: Object })
const open = ref(false), page = ref(1)
const pagination = computed(() => paginateAuditResults(props.exclusions?.items || [], page.value))
</script>
<template>
    <Card v-if="exclusions?.items.length" title="Исключённые URL">
        <div class="flex items-center gap-1"><p class="text-xs text-ui-muted">Исключено URL: {{ exclusions.items.length }}{{ exclusions.limited ? '+' : '' }}</p><SeoAuditInfo label="Пояснение исключённых URL" text="Свои правила и robots.txt проверяются до запроса. Meta noindex и X-Robots-Tag определяются после ответа. Исключённые адреса не участвуют в дальнейшем обходе; причина указана у каждого URL." /></div>
        <details class="mt-2 text-xs" @toggle="open = $event.target.open">
            <summary class="cursor-pointer text-ui-accent">Показать адреса и причины</summary>
            <div v-if="open" class="mt-2 grid gap-2">
                <ul class="grid min-w-0 gap-2">
                    <li v-for="item in pagination.items" :key="item.url" class="grid min-w-0 gap-1 rounded-control border border-ui-border p-2" data-audit-exclusion>
                        <a :href="item.url" target="_blank" rel="noreferrer" class="wrap-anywhere text-ui-accent">{{ item.url }}</a>
                        <span class="wrap-anywhere text-ui-muted">{{ item.reason }} · {{ item.status ? `HTTP ${item.status} получен для определения запрета` : 'HTTP-запрос к URL не отправлялся' }}</span>
                        <SeoAuditSources :sources="item.sources" :sitemaps="item.sitemaps" :current="item.current" />
                    </li>
                </ul>
                <nav v-if="pagination.count > 1" class="flex flex-wrap items-center gap-2" aria-label="Страницы исключённых URL">
                    <Button variant="secondary" size="sm" :disabled="pagination.page === 1" @click="page = pagination.page - 1">Назад</Button>
                    <span>{{ pagination.page }} / {{ pagination.count }}</span>
                    <Button variant="secondary" size="sm" :disabled="pagination.page === pagination.count" @click="page = pagination.page + 1">Далее</Button>
                </nav>
            </div>
        </details>
    </Card>
</template>

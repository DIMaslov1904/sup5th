<script setup>
import { computed } from 'vue'
import SeoAuditIssues from './SeoAuditIssues.vue'
import SeoAuditFocus from './SeoAuditFocus.vue'
import Card from '../popup/components/ui/Card.vue'
import Button from '../popup/components/ui/Button.vue'
const props = defineProps({ issues: Array, audit: Object, focusId: String, busy: Boolean })
const filter = defineModel('filter', { type: String, default: 'problems' })
const emit = defineEmits(['select', 'back'])
const issue = computed(() => props.issues?.find(item => item.id === props.focusId))
</script>
<template>
    <KeepAlive :max="10">
        <SeoAuditFocus v-if="issue" :key="issue.id" :issue="issue" :audit="audit" @back="emit('back')" />
        <SeoAuditIssues v-else-if="!focusId" v-model:filter="filter" :issues="issues" @select="emit('select', $event)" />
        <Card v-else title="Проверка по ссылке">
            <p class="mb-3 text-xs text-ui-muted" role="status">{{ busy ? 'Результаты ещё собираются. Проверка появится после получения нужных данных.' : 'В этом отчёте такой проверки нет. Возможно, она неприменима к выбранному режиму.' }}</p>
            <Button variant="secondary" size="sm" @click="emit('back')">← К ошибкам</Button>
        </Card>
    </KeepAlive>
</template>

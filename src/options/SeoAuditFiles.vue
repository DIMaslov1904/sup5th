<script setup>
import { computed } from 'vue'
import { evaluateRobotsFile } from '../utils/seoRules.js'
import Card from '../popup/components/ui/Card.vue'
import SitemapDuplicates from './SitemapDuplicates.vue'
import { auditLlmCheck } from '../utils/seoAuditLlm.js'
import SeoAuditInfo from './SeoAuditInfo.vue'
const props = defineProps({ audit: Object, report: Object })
const robots = computed(() => ['googlebot', 'yandex'].map(agent => ({ agent, ...evaluateRobotsFile(props.audit.robotsFile, props.report.url, agent) })))
const sitemapLabels = { valid: 'XML прочитан', missing: 'Не найден', invalid: 'Ошибка обнаруженной карты', unknown: 'Не удалось подтвердить' }
const llm = computed(() => props.audit.llmTxt || props.report.llmTxt)
const llmCheck = computed(() => auditLlmCheck(llm.value))
</script>
<template>
    <Card v-if="llm" title="llm.txt">
        <a :href="llm.url" target="_blank" rel="noreferrer" class="wrap-anywhere text-xs text-ui-accent">{{ llm.url }}</a>
        <p class="mt-1 text-xs" :class="llmCheck.status === 'pass' ? 'text-ui-success' : 'text-ui-warning'">{{ llmCheck.hint }}</p>
    </Card>
    <Card title="Sitemap">
        <p class="text-xs" :class="audit.sitemap.state === 'invalid' ? 'text-ui-danger' : audit.sitemap.state === 'valid' && audit.sitemap.complete ? 'text-ui-success' : 'text-ui-warning'">{{ audit.sitemap.pending ? 'Обработка sitemap…' : sitemapLabels[audit.sitemap.state] }}</p>
        <p class="mt-2 text-xs">Прочитано файлов: {{ audit.sitemap.files.length }} · URL: {{ audit.sitemap.pages.length }} · Повторов URL: {{ audit.sitemap.duplicates }}</p>
        <p class="mt-1 text-xs">Текущий URL: {{ audit.sitemap.containsCurrent ? 'найден' : audit.sitemap.state === 'missing' ? 'проверка неприменима' : audit.sitemap.complete ? 'не найден в обработанных картах' : 'результат неизвестен' }}</p>
        <p v-if="!audit.sitemap.pending && !audit.sitemap.complete && audit.sitemap.state !== 'missing'" class="mt-2 text-xs text-ui-warning">Обработка неполная{{ audit.sitemap.discoveryKnown === false ? ': robots.txt не прочитан, список карт может быть неполным' : '' }}.</p>
        <SitemapDuplicates :items="audit.sitemap.duplicateUrls" />
        <ul class="mt-2 grid gap-1 text-xs"><li v-for="file in audit.sitemap.files" :key="file.url" class="break-all"><a :href="file.url" target="_blank" rel="noreferrer" class="text-ui-accent">{{ file.url }}</a> · HTTP {{ file.status }} · {{ file.index ? 'индекс карт' : file.count + ' URL' }}</li><li v-for="error in audit.sitemap.errors" :key="error.url" class="break-all text-ui-warning">{{ error.url }} — {{ error.message }}</li></ul>
    </Card>
    <Card title="Robots.txt: правила для текущего пути">
        <div class="mb-2 flex items-center gap-1"><a :href="audit.robotsFile.url" target="_blank" rel="noreferrer" class="text-xs text-ui-accent">robots.txt</a><SeoAuditInfo label="Пояснение правил robots.txt" text="Показаны правила исходного сайта для текущего пути. Свои исключения аудита не изменяют robots.txt на сервере." /></div>
        <section v-for="group in robots" :key="group.agent" class="mt-2 grid gap-1.5 text-xs">
            <h3 class="font-semibold" :class="group.allowed === null ? 'text-ui-muted' : group.allowed ? 'text-ui-success' : 'text-ui-danger'">{{ group.agent }} — {{ group.allowed === null ? 'неизвестно' : group.allowed ? 'обход разрешён' : 'обход запрещён' }}</h3>
            <p v-if="!group.rules.length" class="text-ui-muted">{{ group.allowed === null ? 'Правила не получены полностью' : 'Подходящих ограничений не найдено' }}</p>
            <div v-for="(rule,index) in group.rules" :key="index" class="grid gap-1 rounded-control bg-ui-field/40 px-2 py-1.5"><span class="break-all">{{ rule.directive.toUpperCase() }}: {{ rule.value }}</span><span class="text-[11px] text-ui-muted">{{ index === 0 ? 'Определяет результат' : 'Перекрыто правилом выше' }}</span></div>
        </section>
    </Card>
</template>

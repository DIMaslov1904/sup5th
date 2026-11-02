<script setup>
import { computed } from 'vue'
import { AUDIT_MODES } from '../utils/seoAuditLinks.js'
import Tabs from '../popup/components/ui/Tabs.vue'
import ToggleSwitch from '../popup/components/ui/ToggleSwitch.vue'
import SeoAuditInfo from './SeoAuditInfo.vue'
import SeoAuditLimit from './SeoAuditLimit.vue'
const props = defineProps({ busy: Boolean, state: String, minimumLimit: Number, minimumCrawlLimit: Number, pagesPending: Boolean, crawlPending: Boolean })
const mode = defineModel('mode', { type: String, default: 'pages' })
const pageLimit = defineModel('pageLimit', { type: [Number, String], default: 100 })
const crawlPageLimit = defineModel('crawlPageLimit', { type: [Number, String], default: 100 })
const excludeNonIndexable = defineModel('excludeNonIndexable', { type: Boolean, default: true })
const customExclusions = defineModel('customExclusions', { type: String, default: '' })
const emit = defineEmits(['normalize'])
const modes = AUDIT_MODES.map(item => [item.value, item.label])
const selected = computed(() => AUDIT_MODES.find(item => item.value === mode.value))
const limitLabel = computed(() => mode.value === 'external' ? 'Лимит внешних URL' : mode.value === 'pages' ? 'Лимит страниц' : 'Лимит внутренних URL')
const limitHint = computed(() => `${mode.value === 'external' ? 'Сколько уникальных внешних адресов проверить.' : 'Сколько внутренних адресов проверить.'} Верхнего предела нет. На паузе можно изменить число, но не ниже уже отправленных запросов.`)
const exclusionHint = 'Правила Allow: и Disallow: с путями от /, шаблонами * и окончанием $. Более точное правило имеет приоритет; при одинаковой длине — Allow. Комментарии начинаются с #. User-agent можно не указывать. Правила действуют на пути внутренних и внешних URL, даже если переключатель индексации выключен.'
</script>
<template>
    <section class="ui-panel audit-settings grid gap-3" aria-label="Настройки аудита">
        <div class="flex min-w-0 items-start gap-1">
            <Tabs v-model="mode" :items="modes" label="Режим проверки" :disabled="busy" class="audit-mode-tabs min-w-0 flex-1" wrap />
            <SeoAuditInfo :text="selected.hint" label="Пояснение режима проверки" class="mt-1" />
        </div>
        <SeoAuditLimit v-model="pageLimit" :label="limitLabel" input-label="Лимит HTTP-проверки" :hint="limitHint" :minimum="minimumLimit" :disabled="busy && (state !== 'paused' || !pagesPending)" @normalize="emit('normalize')" />
        <SeoAuditLimit v-if="mode === 'external'" v-model="crawlPageLimit" label="Лимит обхода страниц" input-label="Лимит обхода страниц" hint="Сколько внутренних страниц использовать для поиска внешних ссылок. Верхнего предела нет. Число можно изменить на паузе." :minimum="minimumCrawlLimit" :disabled="busy && (state !== 'paused' || !crawlPending)" @normalize="emit('normalize')" />
        <div class="flex items-center gap-1">
            <ToggleSwitch v-model="excludeNonIndexable" label="Исключать неиндексируемые страницы" :disabled="busy" />
            <SeoAuditInfo label="Пояснение исключения неиндексируемых страниц" text="Учитывает robots.txt, meta noindex и X-Robots-Tag для Googlebot и Яндекса. Robots.txt проверяется до запроса, noindex — после получения ответа. Исключённые страницы не участвуют в дальнейшем обходе." />
        </div>
        <div class="grid min-w-0 gap-1">
            <div class="flex items-center gap-1"><label for="audit-custom-exclusions" class="text-xs">Свои исключения</label><SeoAuditInfo :text="exclusionHint" label="Синтаксис своих исключений" /></div>
            <textarea id="audit-custom-exclusions" v-model="customExclusions" name="customExclusions" rows="2" :disabled="busy" class="ui-field h-auto min-h-16 resize-y py-2 font-mono text-xs" placeholder="Disallow: /private/&#10;Allow: /private/public/" spellcheck="false" autocapitalize="off" autocorrect="off" autocomplete="off"></textarea>
        </div>
    </section>
</template>
<style scoped>
.audit-settings { container-type: inline-size; }
.audit-mode-tabs :deep(.ui-tab) { height: auto; min-height: 2rem; max-inline-size: 100%; flex-shrink: 1; white-space: normal; padding-block: .4rem; }
</style>

<script setup>
import { computed, useId } from 'vue'
import { AUDIT_EXCLUSION_LABELS } from '../utils/seoAuditExclusionRules.js'
import { AUDIT_MODES } from '../utils/seoAuditLinks.js'
import Button from '../popup/components/ui/Button.vue'
import Tabs from '../popup/components/ui/Tabs.vue'
import ToggleSwitch from '../popup/components/ui/ToggleSwitch.vue'
import SeoAuditInfo from './SeoAuditInfo.vue'
import SeoAuditLimit from './SeoAuditLimit.vue'
defineProps({ disabled: Boolean, paused: Boolean, minimumLimit: Number, minimumCrawlLimit: Number })
const open = defineModel('open', { type: Boolean, required: true })
const exclusionsOpen = defineModel('exclusionsOpen', { type: Boolean, required: true })
const mode = defineModel('mode', { type: String, default: 'pages' })
const pageLimit = defineModel('pageLimit', { type: [Number, String], default: 100 })
const crawlPageLimit = defineModel('crawlPageLimit', { type: [Number, String], default: 100 })
const excludeNonIndexable = defineModel('excludeNonIndexable', { type: Boolean, default: true })
const exclusionLists = defineModel('exclusionLists', { type: Object, required: true })
const emit = defineEmits(['normalize'])
const modes = AUDIT_MODES.map(item => [item.value, item.label])
const selected = computed(() => AUDIT_MODES.find(item => item.value === mode.value))
const limitLabel = computed(() => mode.value === 'external' ? 'Лимит внешних URL' : mode.value === 'pages' ? 'Лимит страниц' : 'Лимит внутренних URL')
const limitHint = computed(() => `${mode.value === 'external' ? 'Сколько уникальных внешних адресов проверить.' : 'Сколько внутренних адресов проверить.'} 0 — без лимита. При продолжении проверки положительный лимит учитывает уже отправленные запросы.`)
const exclusionHint = 'Правила Allow: и Disallow: поддерживают пути от /, шаблоны * и окончание $. Среди списков действует самое точное правило, при одинаковой длине — Allow. Комментарии начинаются с #. User-agent можно не указывать. Правила применяются к внутренним и внешним URL независимо от переключателя индексации.'
const exclusionId = useId()
const exclusionHelpId = `${exclusionId}-help`
let customField
const setCustomField = element => { customField = element }
const updateExclusion = (key, value) => { exclusionLists.value = { ...exclusionLists.value, [key]: value } }
const insertRule = directive => {
    const field = customField
    if (!field || field.disabled) return
    const nextLine = field.value.indexOf('\n', field.selectionEnd)
    const end = nextLine < 0 ? field.value.length : nextLine
    const newline = end > 0 && field.value[end - 1] !== '\n' ? '\n' : ''
    field.focus()
    field.setRangeText(`${newline}${directive} `, end, end, 'end')
    updateExclusion('customExclusions', field.value)
}
</script>
<template>
    <details :open="open" class="ui-panel audit-settings" @toggle.self="open = $event.target.open">
        <summary class="cursor-pointer text-sm font-medium text-ui-accent">Настройки аудита<span v-if="!open" class="ml-1 text-ui-muted">· {{ selected.label }}</span></summary>
        <div class="mt-3 grid gap-3">
            <p v-if="paused" class="text-xs text-ui-muted">Лимиты незавершённых этапов можно применить при продолжении. Изменение режима, правил или лимита завершённого этапа запускает аудит заново.</p>
            <div class="flex min-w-0 items-start gap-1">
                <Tabs v-model="mode" :items="modes" label="Режим проверки" :disabled="disabled" class="audit-mode-tabs min-w-0 flex-1" wrap />
                <SeoAuditInfo v-if="mode !== 'internal'" :text="selected.hint" label="Пояснение режима проверки" class="mt-1" />
            </div>
            <p v-if="mode === 'internal'" class="text-xs text-ui-muted">{{ selected.hint }}</p>
            <SeoAuditLimit v-model="pageLimit" :label="limitLabel" input-label="Лимит HTTP-проверки" :hint="limitHint" :minimum="minimumLimit" :disabled="disabled" @normalize="emit('normalize')" />
            <SeoAuditLimit v-if="mode === 'external'" v-model="crawlPageLimit" label="Лимит обхода страниц" input-label="Лимит обхода страниц" hint="Сколько внутренних страниц использовать для поиска внешних ссылок. 0 — без лимита." :minimum="minimumCrawlLimit" :disabled="disabled" @normalize="emit('normalize')" />
            <div class="flex items-center gap-1">
                <ToggleSwitch v-model="excludeNonIndexable" label="Исключать неиндексируемые страницы" :disabled="disabled" />
                <SeoAuditInfo label="Пояснение исключения неиндексируемых страниц" text="Учитывает robots.txt, meta noindex и X-Robots-Tag для Googlebot и Яндекса. Robots.txt проверяется до запроса, noindex — после получения ответа. Исключённые страницы не участвуют в дальнейшем обходе." />
            </div>
            <details :open="exclusionsOpen" class="min-w-0 border-t border-ui-border/60 pt-2 text-xs" @toggle.self="exclusionsOpen = $event.target.open">
                <summary class="cursor-pointer text-ui-accent">Исключения<span v-if="exclusionLists.customExclusions.trim()" class="ml-1 text-ui-muted">· есть свои правила</span></summary>
                <fieldset class="mt-2 min-w-0">
                    <legend class="sr-only">Списки исключений</legend>
                    <p :id="exclusionHelpId" class="mb-2 text-ui-muted">Все три списка действуют на текущий аудит. После завершения или остановки вернутся начальные списки.</p>
                    <div class="audit-exclusion-lists grid gap-3">
                        <div v-for="(label, key) in AUDIT_EXCLUSION_LABELS" :key="key" class="grid min-w-0 gap-1" :class="key === 'customExclusions' ? 'col-span-full' : 'audit-exclusion-preset'">
                            <div class="flex items-center gap-1">
                                <label :for="`${exclusionId}-${key}`">{{ label }}</label>
                                <SeoAuditInfo v-if="key === 'customExclusions'" :text="exclusionHint" label="Синтаксис исключений" />
                            </div>
                            <textarea :id="`${exclusionId}-${key}`" :ref="key === 'customExclusions' ? setCustomField : undefined" :name="key"
                                :value="exclusionLists[key]" :aria-describedby="exclusionHelpId" :disabled="disabled" :rows="key === 'customExclusions' ? 2 : 5"
                                :placeholder="key === 'customExclusions' ? 'Disallow: /private/\nAllow: /private/public/' : undefined"
                                class="audit-exclusion-field ui-field min-h-16 resize-y py-2 font-mono text-xs" spellcheck="false" autocapitalize="off" autocorrect="off" autocomplete="off"
                                @input="updateExclusion(key, $event.target.value)"></textarea>
                            <div v-if="key === 'customExclusions'" class="flex flex-wrap gap-1">
                                <Button v-for="directive in ['Disallow:', 'Allow:']" :key="directive" variant="ghost" size="sm" :disabled="disabled" @click="insertRule(directive)">Быстрая вставка {{ directive }}</Button>
                            </div>
                        </div>
                    </div>
                </fieldset>
            </details>
        </div>
    </details>
</template>
<style scoped>
.audit-settings { container-type: inline-size; }
.audit-mode-tabs :deep(.ui-tab) { height: auto; min-height: 2rem; max-inline-size: 100%; flex-shrink: 1; white-space: normal; padding-block: .4rem; }
.audit-exclusion-lists { grid-template-rows: auto; grid-auto-rows: 1fr; }
.audit-exclusion-preset { grid-template-rows: auto 1fr; }
.audit-exclusion-field { field-sizing: content; block-size: auto; max-block-size: 24rem; }
.audit-exclusion-preset .audit-exclusion-field { align-self: stretch; resize: none; }
@container (width >= 560px) { .audit-exclusion-lists { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>

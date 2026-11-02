<script setup>
import { useId } from 'vue'
import Button from '../popup/components/ui/Button.vue'
import SeoAuditInfo from './SeoAuditInfo.vue'
const value = defineModel({ type: [Number, String], default: 100 })
defineProps({ label: String, inputLabel: String, hint: String, minimum: { type: Number, default: 1 }, disabled: Boolean })
const emit = defineEmits(['normalize'])
const id = useId(), optionsId = `${id}-options`
const presets = [1, 10, 100, 500, 1000, 5000]
const select = preset => { value.value = preset; emit('normalize') }
</script>
<template>
    <div class="grid min-w-0 gap-1">
        <div class="flex items-center gap-1"><label :for="id" class="text-xs">{{ label }}</label><SeoAuditInfo :text="hint" :label="`Пояснение: ${label}`" /></div>
        <div class="flex min-w-0 items-center gap-2">
            <input :id="id" v-model.number="value" :aria-label="inputLabel" type="number" :list="optionsId" :min="minimum" step="1" class="ui-field w-28 shrink-0" :disabled="disabled" @change="emit('normalize')" />
            <datalist :id="optionsId"><option v-for="preset in presets" :key="preset" :value="preset"></option></datalist>
            <div class="audit-limit-presets min-w-0 items-center gap-1" role="group" :aria-label="`Быстрые значения: ${label}`">
                <Button v-for="preset in presets" :key="preset" variant="ghost" size="sm" :disabled="disabled || preset < minimum" :aria-pressed="Number(value) === preset" :class="Number(value) === preset ? 'bg-ui-accent/12 text-ui-accent' : ''" @click="select(preset)">{{ preset }}</Button>
            </div>
        </div>
    </div>
</template>
<style scoped>
.audit-limit-presets { display: none; }
@container (width >= 720px) { .audit-limit-presets { display: flex; } }
</style>

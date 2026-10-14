<script setup>
defineProps({
    modelValue: { type: [String, Number], default: '' },
    type: { type: String, default: 'text' },
    placeholder: { type: String, default: '' },
    required: { type: Boolean, default: false },
    autocomplete: { type: String, default: '' },
    disabled: { type: Boolean, default: false }
})

defineEmits(['update:modelValue'])
</script>

<template>
    <input :type="type" :placeholder="placeholder" :value="modelValue" :required="required"
        :autocomplete="autocomplete || undefined" :disabled="disabled" @input="$emit('update:modelValue', $event.target.value)"
        class="ui-field" />
</template>

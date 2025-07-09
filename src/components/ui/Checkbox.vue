<template>
  <label class="checkbox">
    <input
      class="checkbox-input"
      type="checkbox"
      :checked="modelValue"
      @change="model = !modelValue"
    />
    <p class="checkbox-label">{{ label }}</p>
  </label>
</template>

<script setup lang="ts">
const model = defineModel();

defineProps<{
  modelValue: boolean;
  label: string;
}>();
</script>
<style lang="scss">
.checkbox-input {
  appearance: none;
  position: relative;
  width: var(--size);
  height: var(--size);
  background: transparent;
  border-radius: 3px;
  border: 1px solid var(--color-input-border);
  transition-property: border-color, background-color;
  transition-delay: 0.2ms;
  margin: 0;

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='https://www.w3.org/2000/svg' fill='none' viewBox='0 0 9 6'%3e%3cpath stroke='%23fff' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.07143' d='M7.83268.70898 3.24935 5.29232 1.16602 3.20898'/%3e%3c/svg%3e");
    background-repeat: no-repeat;
    background-position: center;
    background-size: 10px;
    transition: transform 0.2s;
  }

  &:not(:checked) {
    &::after {
      transform: scale(0);
      opacity: 0;
    }
  }

  &:checked {
    border-color: var(--color-primary);
    background-color: var(--color-primary);
  }

  &:disabled,
  &.disabled {
    background: #ccc;
    border-color: #ccc;

    &::after {
      filter: grayscale(100%);
    }
  }
}

.checkbox {
  --size: 16px;
  display: inline-grid;
  grid-template-columns: var(--size) 1fr;
  gap: 8px;
  line-height: 1;
  cursor: pointer;

  &:hover .checkbox-input:not(:disabled) {
    border-color: var(--color-input-border-hover);
  }

  &:has(.disabled, :disabled) {
    pointer-events: none;
  }
}

.checkbox-label {
  font-size: 14px;
}
</style>

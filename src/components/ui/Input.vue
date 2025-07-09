<template>
  <input type="text" v-model="model" />
</template>

<script setup lang="ts">
const model = defineModel()
</script>

<style lang="scss" scoped>
input {
  padding: 10px;
  border: 1px solid var(--color-input-border);
  border-radius: 4px;
  background-color: transparent;
  outline: none;

  &:hover {
    border-color: var(--color-input-border-hover);
  }
}
</style>
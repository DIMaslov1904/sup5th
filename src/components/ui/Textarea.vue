<template>
  <textarea v-model="model"> </textarea>
</template>

<script setup lang="ts">
const model = defineModel<string>();
</script>

<style lang="scss" scoped>
textarea {
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

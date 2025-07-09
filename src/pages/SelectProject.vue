<template>
  <div class="current-wrapper">
    <CurrentContent :project />
    <Button class="return" @click="$emit('backward')">Назад</Button>
  </div>
</template>

<script setup lang="ts">
import CurrentContent from "@/components/CurrentContent.vue";
import Button from "@/components/ui/Button.vue";
defineProps<{
  project: Project;
}>();

defineEmits<{
  backward: [];
}>();
</script>

<style lang="scss">
.current-wrapper {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: 100%;
  border-radius: 8px;
  background-color: var(--color-bg-body);
  z-index: 20;
  overflow: auto;

  display: grid;
  grid-template-columns: 1fr 56px;

  &.fade-enter-active,
  &.fade-leave-active {
    transition: opacity 0.3s ease;
  }

  &.fade-enter-from,
  &.fade-leave-to {
    opacity: 0;
  }

  .return {
    align-self: flex-end;
  }
}
</style>

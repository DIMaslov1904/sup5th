<template>
  <dialog ref="dialog" @click.self="$emit('close')">
    <div class="wrapper">
      <Button class="close" @click="$emit('close')">закрыть</Button>
      <slot />
    </div>
  </dialog>
</template>

<script setup lang="ts">
import Button from "@/components/ui/Button.vue";
import { ref, watch } from "vue";

const dialog = ref<null | HTMLDialogElement>(null);

const props = defineProps<{
  isShowModal: boolean;
}>();

defineEmits<{
  close: [];
}>();

watch(props, () => {
  if (!dialog.value) return;
  props.isShowModal ? dialog.value.showModal() : dialog.value.close();
});
</script>

<style lang="scss" scoped>
dialog {
  margin: auto;
  border-radius: 9px;
  border: none;
  background-color: var(--color-bg-body);

  .wrapper {
    position: relative;
    max-width: 720px;
    min-width: 200px;
    padding: 32px;
  }

  &::backdrop {
    background-color: rgb(54 57 69 / 50%);
  }

  .close {
    display: block;
    padding: 0;
    position: absolute;
    right: 8px;
    top: 8px;
    font-size: 0;
    color: white;
    width: 24px;
    height: 24px;
    transition: color 0.2s;

    &::before,
    &::after {
      content: "";
      position: relative;
      display: block;
      height: 1px;
      width: 70%;
      background-color: currentColor;
      margin: 0 auto;
    }

    &::before {
      transform: rotate(45deg);
    }

    &::after {
      top: -1px;
      transform: rotate(-45deg);
    }

    &:hover {
      background-color: var(--color-primary);
    }
  }
}
</style>

<template>
  <button class="popup-nav__item" :class="{ 'active': active }" :title>
    <slot />
    <span v-if="count" class="popup-nav__item-count">{{ count }}</span>
  </button>
</template>

<script setup lang="ts">
defineProps({
  title: {
    type: String,
    required: true,
  },
  active: {
    type: Boolean,
    default: false,
  },
  count: {
    type: Number,
  }
})
</script>

<style lang="scss">
.popup-nav__item {
  position: relative;
  border: none;
  background: var(--color-secondary);
  color: var(--color-text-secondary);
  padding: 6px;
  border-radius: 8px;
  transition: background-color 0.2s ease;
  cursor: pointer;
  font-size: 0;

  &:hover {
    background-color: var(--color-secondaty-hover);
  }

  &:disabled {
    pointer-events: none;
  }

  &.active {
    background-color: var(--color-primary);
    color: var(--color-text-primary);

    .popup-nav__item-count {
      background-color: #fff;
      color: #000;
    }
  }
}

.popup-nav__item-count {
  position: absolute;
  bottom: 6px;
  right: 6px;
  background: var(--color-primary);
  height: 16px;
  width: 16px;
  border-radius: 50%;
  line-height: 16px;
  text-align: center;
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-secondary);
}
</style>
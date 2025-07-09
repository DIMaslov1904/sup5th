<template>
  <a v-if="href" :href="href" class="button" :class="`button_${size}`">
    <slot />
  </a>
  <button v-else class="button" :class="`button_${size}`">
    <slot />
  </button>
</template>

<script setup lang="ts">
interface Props {
  size?: 's' | 'm' | 'l',
  href?: string
}

withDefaults(defineProps<Props>(), {
  size: 'm'
})
</script>

<style lang="scss">
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: var(--color-secondary);
  color: var(--color-text-secondary);
  border-radius: 8px;
  text-decoration: none;
  transition: background-color 0.2s ease;
  cursor: pointer;
  gap: 10px;


  &_s {
    --size-svg: 8px;
    font-size: 12px;
    padding: 2px 6px;
  }

  &_m {
    --size-svg: 16px;
    padding: 5px 10px;
  }

  &_l {
    --size-svg: 24px;
    font-size: 18px;
    padding: 10px 20px;
    min-height: 44px;
  }

  &:hover {
    background-color: var(--color-secondaty-hover);
  }

  &:disabled {
    opacity: 0.8;
    pointer-events: none;
  }

  svg,
  img {
    max-width: var(--size-svg);
    max-height: var(--size-svg);
  }

}
</style>
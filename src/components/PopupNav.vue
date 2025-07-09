<template>
  <nav class="popup-nav">
    <slot />
  </nav>
</template>

<style lang="scss">
.popup-nav {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 2px 2px 2px 6px;
  width: 56px;
}
</style>
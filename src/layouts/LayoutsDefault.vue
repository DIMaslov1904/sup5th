<template>
  <div class="popup-container">
    <slot />
  </div>
</template>

<style lang="scss">
:root {
  color-scheme: light dark;

  --color-bg-body: light-dark(#fff, #2E2F38);
  --color-primary: #ef3e2c;
  --color-secondary: light-dark(#fff, #2e2f38);
  --color-secondaty-hover: light-dark(#cfd0d8, #454654);
  --color-text-primary: #fff;
  --color-text: light-dark(#000, #fff);
  --color-text-secondary: light-dark(#000, #fff);

  --color-input-border: light-dark(rgba(0 0 0 / .5), rgba(255 255 255 / .5));
  --color-input-border-hover: light-dark(rgba(0 0 0 / 1) rgba(255 255 255 / 1));
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

::-webkit-scrollbar {
  width: 5px;
}

::-webkit-scrollbar-track {
  background: var(--color-bg-body);
}

::-webkit-scrollbar-thumb {
  background-color: var(--color-text);
  border-radius: 3px;
  cursor: grab;
}

::-webkit-scrollbar-thumb:active {
  cursor: grabbing;
}

body {
  font-family: Arial, Helvetica, sans-serif;
  background-color: var(--color-bg-body);
  color: var(--color-text);
  line-height: 1.2;
  font-size: 18px;
}

.popup-container {
  display: flex;
  height: 100%;
}

.flex {
  display: flex;
  gap: 10px;
}
</style>
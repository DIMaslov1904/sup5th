<template>
  <form class="settings-form">
    <div class="settings-form__field">
      <span>Ссылка на получение всех проектов</span>
      <Input v-model="apiUrl" />
    </div>
    <div class="settings-form__field">
      <span>Ссылка на получение личных доступов</span>
      <Input v-model="apiAccessUrl" />
    </div>

    <Button @click="removeFromStorage">
      Сбросить настройки и данные
    </Button>
  </form>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useMainStore } from '@/stores'
import { removeFromStorage } from '@/utils/chrome-api'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'

const mainStore = useMainStore()

const apiUrl = computed({
  get: () => mainStore.state.apiUrl,
  set: (val) => mainStore.setApiUrl(val)
})
const apiAccessUrl = computed({
  get: () => mainStore.state.apiAccessUrl,
  set: (val) => mainStore.setApiAccessUrl(val)
})
</script>

<style lang="scss">
.settings-form {
  display: grid;
  gap: 23px;
  padding: 20px;
  justify-items: start;
}

.settings-form__field {
  display: grid;
  gap: 6px;
  width: 100%;
}
</style>
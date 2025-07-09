<template>
  <div class="empty-projects">
    <p class="empty-projects__title">Список проектов пуст</p>

    <div class="empty-projects__mess-api">
      <p>Проверьте доступность общего списка проектов</p>
      <Input v-model="apiUrl" />
    </div>

    <div class="empty-projects__mess-upd">
      <p>Затем попробуйте обновить список</p>
      <Button @click="projectsStore.update">Обновить</Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useMainStore, useProjectsStore } from '@/stores';
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'

const mainStore = useMainStore()
const projectsStore = useProjectsStore()

const apiUrl = computed({
  get: () => mainStore.state.apiUrl,
  set: (val) => mainStore.setApiUrl(val)
})
</script>

<style lang="scss">
.empty-projects {
  display: grid;
  align-content: center;
  justify-items: center;
  height: 100%;
  gap: 24px;
  font-size: 18px;
  padding: 15px;
  text-align: center;
}

.empty-projects__title {
  font-size: 32px;
  font-weight: 600;
}

.empty-projects__mess-api {
  display: grid;
  gap: 10px;
}

.empty-projects__mess-upd {
  display: flex;
  align-items: center;
  gap: 24px;
}
</style>
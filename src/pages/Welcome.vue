<template>
  <div class="welcome-wrapper">
    <div v-if="layout === 'welcome'" class="welcome-page">
      <h2>Приветсвие</h2>
      <div class="welcome-input-wrap">
        <Input class="welcome-input" v-model="apiAccessUrl" placeholder="Url до api с личными доступами"
          style="padding-right: 140px;" />
        <Button @click="setLayout('instruction')">Как получить url?</Button>
      </div>

      <div class="welcome-input-wrap">
        <Input class="welcome-input" v-model="apiUrl" placeholder="Url до api со всеми проектами (из инструкции)" />
      </div>

      <div class="flex welcome-buttons">
        <Button @click="store.setApiAccessUrl(apiAccessUrl)">Продолжить</Button>
      </div>
    </div>
    <template v-else>
      <Instruction />
      <div class="welcome-return-wrap">
        <Button class="welcome-return" @click="setLayout('welcome')">Вернуться</Button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted, computed } from 'vue'
import { useMainStore, useProjectsStore } from '@/stores'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Instruction from './Instruction.vue'

const store = useMainStore()
const projectsStore = useProjectsStore()
const apiAccessUrl = ref(store.state.apiAccessUrl)

const layout = ref('welcome')

const emits = defineEmits<{
  setIsFixHeight: [boolean]
}>()

const setLayout = (name: string) => {
  emits('setIsFixHeight', name === 'welcome')
  layout.value = name
}

const apiUrl = computed({
  get: () => store.state.apiUrl,
  set: (val) => store.setApiUrl(val)
})

onUnmounted(async () => {
  if (store.state.apiUrl && apiAccessUrl.value)
    await projectsStore.updateAll()
  else if (apiAccessUrl.value)
    await projectsStore.updateAccess()
})
</script>

<style lang="scss">
.welcome-wrapper {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: 100%;
  border-radius: 8px;
  background-color: #000;
  color: #fff;
  z-index: 10;
  overflow: auto;
  padding: 10px;


  &.fade-leave-to {
    animation: fade 1s ease-in-out;
  }

  @keyframes fade {
    0% {
      width: 100%;
    }

    50% {
      width: 604px;
      opacity: 1;
    }

    100% {
      width: 604px;
      opacity: 0;
    }
  }
}

.welcome-page {
  display: flex;
  flex-direction: column;
  justify-content: center;
  text-align: center;
  gap: 20px;
  height: 100%;
}

.welcome-input-wrap {
  position: relative;
  width: 80%;
  margin: 0 auto;

  button {
    position: absolute;
    right: 5px;
    top: 50%;
    transform: translateY(-50%);
  }
}

.welcome-return-wrap {
  height: 45px;
}

.welcome-return {
  position: fixed;
  bottom: 10px;
  right: 10px;
}

.welcome-input {
  width: 100%;
}

.welcome-buttons {
  justify-content: center;
}
</style>
<template>
  <div
    class="welcome-wrapper bg-linear-to-t from-sky-950 to-indigo-950 text-white fixed inset-0 rounded-lg overflow-auto z-10 p-2.5">
    <div v-if="layout === 'welcome'" class="flex flex-col h-full justify-center text-center gap-4">
      <h2>Приветсвие</h2>
      <div class="relative w-4/5 mx-auto">
        <Input class="w-full" v-model="apiAccessUrl" placeholder="Url до api с личными доступами"
          style="padding-right: 140px" />
        <Button class="right-1 absolute top-1/2 transform-[translateY(-50%)]" @click="setLayout('instruction')">Как
          получить url?</Button>
      </div>

      <div class="relative w-4/5 mx-auto">
        <Input class="w-full" v-model="apiUrl" placeholder="Url до api со всеми проектами (из инструкции)" />
      </div>

      <div class="flex justify-center">
        <Button @click="store.setApiAccessUrl(apiAccessUrl)">Продолжить</Button>
      </div>
    </div>
    <template v-else>
      <Instruction />
      <div class="w-10">
        <Button class="fixed bottom-2.5 right-2.5" @click="setLayout('welcome')">Вернуться</Button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted, computed } from "vue";
import { useMainStore, useProjectsStore } from "@/stores";
import Button from "@/components/ui/Button.vue";
import Input from "@/components/ui/Input.vue";
import Instruction from "./Instruction.vue";

const store = useMainStore();
const projectsStore = useProjectsStore();
const apiAccessUrl = ref(store.state.apiAccessUrl);

const layout = ref("welcome");

const emits = defineEmits<{
  setIsFixHeight: [boolean];
}>();

const setLayout = (name: string) => {
  emits("setIsFixHeight", name === "welcome");
  layout.value = name;
};

const apiUrl = computed({
  get: () => store.state.apiUrl,
  set: (val) => store.setApiUrl(val),
});

onUnmounted(async () => {
  if (store.state.apiUrl && apiAccessUrl.value) await projectsStore.updateAll();
  else if (apiAccessUrl.value) await projectsStore.updateAccess();
});
</script>

<style lang="scss">
.welcome-wrapper {
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
</style>

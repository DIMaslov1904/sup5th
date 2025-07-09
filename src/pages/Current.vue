<template>
  <p v-if="!project" class="empty">
    Данный сайнт не найдев в ативных проектах 5 измерения
  </p>
  <CurrentContent v-else :project />
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { getCurrentTab } from "@/utils/chrome-api";
import CurrentContent from "@/components/CurrentContent.vue";
import { useProjectsStore } from "@/stores";

const projectsStore = useProjectsStore();

const project = ref<Project | null>(null);

onMounted(async () => {
  const curTab = await getCurrentTab();
  if (!curTab || !curTab.url) return;
  const currentDomain = new URL(curTab.url).hostname;
  project.value = projectsStore.state.projects.find((el: Project) =>
    el.url
      ? el.subdomain
        ? curTab.url?.includes(el.url)
        : currentDomain === el.url
      : false,
  );
});
</script>

<style lang="scss" scoped>
.empty {
  display: flex;
  align-items: center;
  height: 100%;
  text-align: center;
  max-width: 300px;
  margin: 0 auto;
}
</style>

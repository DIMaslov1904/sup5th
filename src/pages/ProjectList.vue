<template>
  <transition name="fade">
    <SelectProject
      v-if="'url' in selectProjectState.state"
      :project="selectProjectState.state"
      @backward="backward"
    />
  </transition>

  <div v-if="projectsStore.state.projects.length > 0">
    <header class="projects-header">
      <Checkbox label="Есть доступ" v-model="isAccess" />
      <Search v-model="searchComputed" />
      <Button @click="projectsStore.updateAccess">Обновить доступы</Button>
    </header>
    <ul class="project-list">
      <ProjectItem
        v-for="project in getListSetFilters()"
        :key="project.url"
        :project="project"
        @setSite="setSite(project)"
      />
    </ul>
  </div>
  <EmptyProjects v-else />
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from "vue";
import switcher from "@/utils/switcher";
import { useProjectsStore, useSelectProjectStore } from "@/stores";
import ProjectItem from "@/components/ProjectItem.vue";
import Checkbox from "@/components/ui/Checkbox.vue";
import Search from "@/components/ui/Search.vue";
import EmptyProjects from "@/components/EmptyProjects.vue";
import SelectProject from "@/pages/SelectProject.vue";
import Button from "@/components/ui/Button.vue";

const projectsStore = useProjectsStore();
const isAccess = ref(false);
const search = ref("");
const searchRU = ref("");
const searchEN = ref("");

const emits = defineEmits<{
  setIsFixHeight: [boolean];
}>();

onUnmounted(() => {
  emits("setIsFixHeight", true);
});

const backward = () => {
  emits("setIsFixHeight", false);
  selectProjectState.removeProject();
};

const setSite = (project: Project) => {
  emits("setIsFixHeight", true);
  selectProjectState.setProject(project);
};

const getListSetFilters = () => {
  const res =
    isAccess || search
      ? projectsStore.state.projects.filter(filterProjects)
      : projectsStore.state.projects;
  if (!("url" in selectProjectState.state))
    emits("setIsFixHeight", res.length <= 3);
  return res;
};

const selectProjectState = useSelectProjectStore();

const searchComputed = computed({
  get: () => search.value,
  set: (newValue: string) => {
    newValue = newValue.toLowerCase();
    searchRU.value = switcher(newValue);
    searchEN.value =
      searchRU.value === newValue ? switcher(newValue, { type: "rueng" }) : "";
    search.value = newValue;
  },
});

const searchFilter = (project: Project) => {
  if (!search.value) return true;
  const name = project.name.toLowerCase();
  const url = project.url.toLowerCase();
  if (searchEN.value)
    return (
      name.includes(search.value) ||
      url.includes(search.value) ||
      name.includes(searchEN.value) ||
      url.includes(searchEN.value)
    );
  return (
    name.includes(search.value) ||
    url.includes(search.value) ||
    name.includes(searchRU.value)
  );
};
const filterProjects = (project: Project) => {
  if (isAccess.value) {
    if (search.value) return searchFilter(project) && project.login !== "";
    return project.login !== "";
  }
  if (search.value) return searchFilter(project);
  return true;
};
</script>

<style lang="scss">
.projects-header {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 10px;
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--color-bg-body);
  padding: 5px;
}

.project-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 8px;
  padding: 10px;
}
</style>

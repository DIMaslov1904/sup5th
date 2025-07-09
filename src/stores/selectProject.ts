import { defineStore } from "pinia";
import { ref } from "vue";
import { setToStorage, getFromStorage } from "@/utils/chrome-api";

const STORAGE_NAME = "selectProjectState";

const defaultState = () => ({});

export const useSelectProjectStore = defineStore(STORAGE_NAME, () => {
  const state = ref<{} | Project>(defaultState());

  const setProject = (project: Project) => {
    state.value = project;
    saveToStorage();
  };

  const removeProject = () => {
    state.value = {};
    saveToStorage();
  };

  const saveToStorage = () => setToStorage(STORAGE_NAME, state.value);

  const loadFromStorage = async () => {
    const result = await getFromStorage(STORAGE_NAME);
    state.value = result === undefined ? defaultState() : result;
  };

  return {
    state,
    setProject,
    removeProject,
    loadFromStorage,
  };
});

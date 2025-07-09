import { defineStore } from "pinia";
import { ref } from "vue";
import { setToStorage, getFromStorage } from "@/utils/chrome-api";

const STORAGE_NAME = "mainState";

const defaultState = () => ({
  page: "currentSite",
  apiUrl: "",
  apiAccessUrl: "",
  hiddenAdmButton: false,
});

export const useMainStore = defineStore(STORAGE_NAME, () => {
  const state = ref<any>(defaultState());

  const setPage = (pageIn: string) => {
    state.value = { ...state.value, page: pageIn };
    saveToStorage();
  };

  const setApiUrl = (urlIn: string) => {
    state.value = { ...state.value, apiUrl: urlIn };
    saveToStorage();
  };

  const setApiAccessUrl = (urlIn: string) => {
    state.value = { ...state.value, apiAccessUrl: urlIn, init: undefined };
    saveToStorage();
  };

  const saveToStorage = () => setToStorage(STORAGE_NAME, state.value);

  const loadFromStorage = async () => {
    const result = await getFromStorage(STORAGE_NAME);
    state.value =
      result === undefined ? { ...state.value, init: true } : result;
  };

  return {
    state,
    setPage,
    setApiUrl,
    setApiAccessUrl,
    loadFromStorage,
  };
});

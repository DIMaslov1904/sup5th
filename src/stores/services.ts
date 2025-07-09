import { defineStore } from "pinia";
import { ref } from "vue";
import { setToStorage, getFromStorage } from "@/utils/chrome-api";
import { geServices } from "@/utils/services-api";
import { useNoticeStore } from "./notice";
import { cleanUrl } from "@/utils/url";
import debounce from "@/utils/debounce";

const STORAGE_NAME = "servicesState";

const defaultState = (): ServicesState => ({
  personal: "",
  favourites: {},
  list: [],
});

export const useServicesStore = defineStore(STORAGE_NAME, () => {
  const state = ref<any>(defaultState());
  const isLoading = ref(false);

  const add = (services: ServicesItem | ServicesGroup) =>
    (state.value.list = [...state.value.list, { ...services }]);

  const chandeFavorites = (services?: ServicesItem) => {
    state.value.favourites = services || {};
    saveToStorage();
  };

  const changePersonal = (val: string) => {
    state.value.personal = val;
    debounceSaveToStorage();
  };

  const removeAll = () => {
    state.value.list = [];
    saveToStorage();
  };

  const update = async () => {
    const noticeStore = useNoticeStore();
    isLoading.value = true;
    const res = await geServices();
    isLoading.value = false;

    if (res.result.length === 0) {
      noticeStore.add("error", "Сервисы не найдены", 10);
      return;
    }

    removeAll();

    for (const item of res.result) {
      add({
        url: cleanUrl(item[2]),
        name: item[0],
        description: item[1],
      });
    }

    noticeStore.add("success", "Сервисы загружены", 10);

    saveToStorage();
  };

  const saveToStorage = () => setToStorage(STORAGE_NAME, state.value);

  const debounceSaveToStorage = debounce(saveToStorage, 1000);

  const loadFromStorage = async () => {
    const result = await getFromStorage(STORAGE_NAME);
    state.value = result === undefined ? defaultState() : result;
  };

  return {
    state,
    isLoading,
    update,
    changePersonal,
    chandeFavorites,
    loadFromStorage,
  };
});

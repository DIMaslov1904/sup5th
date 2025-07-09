import { defineStore } from "pinia";
import { ref } from "vue";
import { setToStorage, getFromStorage } from "@/utils/chrome-api";

const STORAGE_NAME = "noticeState";

const defaultState = () => [];

type NoticeType = "success" | "error" | "warning" | "info";

type Notice = {
  timestamp: number;
  timestampEnd: number;
  type: NoticeType;
  text: string;
};

export const useNoticeStore = defineStore(STORAGE_NAME, () => {
  const state = ref<any>(defaultState());

  const add = (type: NoticeType, text: string, duration: number = 86400) => {
    state.value = [
      ...state.value,
      {
        timestamp: new Date().getTime(),
        type,
        text,
        timestampEnd: new Date().getTime() + duration * 1000,
      },
    ];
    saveToStorage();
  };

  const remove = (timestamp: number) => {
    state.value = state.value.filter(
      (item: Notice) => item.timestamp !== timestamp,
    );
    saveToStorage();
  };

  const removeAll = () => {
    state.value = [];
    saveToStorage();
  };

  const checkExpired = () => {
    const now = new Date().getTime();
    state.value = state.value.filter((item: Notice) => {
      if (item.timestampEnd && item.timestampEnd < now) return false;
      return true;
    });
    saveToStorage();
  };

  const saveToStorage = () => setToStorage(STORAGE_NAME, state.value);

  const loadFromStorage = async () => {
    const result = await getFromStorage(STORAGE_NAME);
    state.value = result === undefined ? defaultState() : result;
    if (state.value.length > 0) checkExpired();
  };

  return {
    state,
    add,
    remove,
    removeAll,
    loadFromStorage,
  };
});

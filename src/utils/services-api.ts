import { useMainStore, useNoticeStore } from "@/stores";
import { GET_PARM_GET_SERVICES } from "@/globVars";

export const geServices = async () => {
  const store = useMainStore();
  const noticeStore = useNoticeStore();

  if (!store.state.apiUrl) {
    noticeStore.add("error", `Не указан адрес API для получения проектов`);
    return { result: [] };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(
      `${store.state.apiUrl + GET_PARM_GET_SERVICES}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      noticeStore.add(
        "error",
        `Ошибка при получении сервисов: ${response.status}`,
      );
      return { result: [] };
    }
    return await response.json();
  } catch (error) {
    noticeStore.add("error", `Ошибка при получении сервисов: ${error}`);
    return { result: [] };
  } finally {
    clearTimeout(timeoutId);
  }
};

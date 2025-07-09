import { useMainStore, useNoticeStore } from "@/stores";

export const getProjects = async () => {
  const store = useMainStore();
  const noticeStore = useNoticeStore();

  if (!store.state.apiUrl) {
    noticeStore.add("error", `Не указан адрес API для получения проектов`);
    return { result: [] };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(`${store.state.apiUrl}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      noticeStore.add(
        "error",
        `Ошибка при получении проектов: ${response.status}`,
      );
      return { result: [] };
    }
    const r = await response.json();
    if (r.result.length === 0)
      noticeStore.add("warning", `Пустой результат запроса проектов`);
    return r;
  } catch (error) {
    noticeStore.add("error", `Ошибка при получении проектов: ${error}`);
    return { result: [] };
  } finally {
    clearTimeout(timeoutId);
  }
};

export const getAccess = async () => {
  const store = useMainStore();
  const noticeStore = useNoticeStore();

  if (!store.state.apiAccessUrl) {
    noticeStore.add("error", `Не указан адрес API для доступов`);
    return { result: [] };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(`${store.state.apiAccessUrl}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      noticeStore.add(
        "error",
        `Ошибка при получении доступов: ${response.status}`,
      );
    }
    const r = await response.json();
    if (r.result.length === 0)
      noticeStore.add("warning", `Пустой результат запроса доступов`);
    return r;
  } catch (error) {
    noticeStore.add("error", `Ошибка при получении доступов: ${error}`);
    return { result: [] };
  } finally {
    clearTimeout(timeoutId);
  }
};

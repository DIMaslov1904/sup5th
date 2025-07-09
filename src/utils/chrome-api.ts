export const getCurrentTab = async (): Promise<chrome.tabs.Tab | null> => {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    return tab || null;
  } catch (error) {
    console.error("Ошибка при получении текущей вкладки:", error);
    return null;
  }
};

export const sendMessageToTab = async (tabId: number, message: any) => {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (error) {
    console.error("Ошибка при отправке сообщения во вкладку:", error);
    return null;
  }
};

export const getFromStorage = async (key: string) => {
  try {
    const result = await chrome.storage.local.get([key]);
    if (result[key] !== undefined) return JSON.parse(result[key]);
    return undefined;
  } catch (error) {
    console.error("Ошибка при получении из хранилища:", error);
    return {};
  }
};

export const setToStorage = async (key: string, data: Record<string, any>) => {
  try {
    await chrome.storage.local.set({ [key]: JSON.stringify(data) });
  } catch (error) {
    console.error("Ошибка при сохранении в хранилище:", error);
  }
};

export const removeFromStorage = async () => {
  try {
    await chrome.storage.local.clear();
    await chrome.runtime.reload();
  } catch (error) {
    console.error("Ошибка при удалении из хранилища:", error);
  }
};

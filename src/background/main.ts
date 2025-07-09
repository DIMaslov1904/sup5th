chrome.runtime.onInstalled.addListener(() => {
  console.log("Установленное расширение");
});

chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
  console.log("Сообщение из background:", message);

  if (message.type === "GET_TAB_INFO") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      sendResponse({ tab: tabs[0] });
    });
    return true;
  }
});

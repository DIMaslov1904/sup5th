// Checked separately: Firefox declares a global `browser` namespace.
export type FirefoxApi = typeof browser
export type FirefoxTab = browser.tabs.Tab
export type FirefoxMessageSender = browser.runtime.MessageSender

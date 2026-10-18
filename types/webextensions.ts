import type Browser from 'webextension-polyfill'

// Shared WebExtensions types; Safari API availability still needs runtime checks.
export type WebExtensionApi = typeof Browser
export type WebExtensionTab = Browser.Tabs.Tab
export type WebExtensionMessageSender = Browser.Runtime.MessageSender

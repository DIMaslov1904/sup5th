import type Browser from 'webextension-polyfill'

// Shared WebExtensions API types.
export type WebExtensionApi = typeof Browser
export type WebExtensionTab = Browser.Tabs.Tab
export type WebExtensionMessageSender = Browser.Runtime.MessageSender

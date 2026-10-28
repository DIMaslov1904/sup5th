// @ts-check

// Native Promise APIs: browser in Firefox, chrome in older Chromium versions.
const globals = /** @type {typeof globalThis & { browser?: typeof chrome }} */ (globalThis)
export const extensionApi = globals.chrome?.runtime?.getURL('').startsWith('chrome-extension://')
    ? globals.chrome : globals.browser ?? globals.chrome
export const isFirefox = Boolean(extensionApi?.runtime?.getURL('').startsWith('moz-extension://'))
export const browserTarget = isFirefox ? 'firefox' : 'chromium'

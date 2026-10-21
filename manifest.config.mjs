// @ts-check
import { defineManifest } from "@crxjs/vite-plugin"
import pkg from "./package.json" with { type: "json" }

/** @satisfies {chrome.runtime.ManifestV3} */
const manifest = {
  "manifest_version": 3,
  "name": pkg.displayName,
  "short_name": pkg.name,
  "version": pkg.version,
  "description": pkg.description,
  "homepage_url": "https://github.com/DIMaslov1904/sup5th",
  "action": {
    "default_popup": "src/popup/index.html"
  },
  "background": {
    "service_worker": "src/background/service-worker.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "js": [
        "src/content-script/support.js"
      ],
      "matches": [
        "https://support.5th.ru/*"
      ],
      "run_at": "document_idle"
    }
  ],
  "icons": {
    "16": "src/assets/icons/icon_16.png",
    "19": "src/assets/icons/icon_19.png",
    "32": "src/assets/icons/icon_32.png",
    "38": "src/assets/icons/icon_38.png",
    "48": "src/assets/icons/icon_48.png",
    "64": "src/assets/icons/icon_64.png",
    "128": "src/assets/icons/icon_128.png"
  },
  "options_page": "src/options/index.html",
  "side_panel": { "default_path": "src/sidepanel/index.html" },
  "permissions": [
    "storage",
    "sidePanel",
    "offscreen",
    "webRequest",
    "downloads",
    "alarms",
    "tabs",
    "scripting",
    "activeTab",
    "idle"
  ],
  "host_permissions": [
    "http://*/*",
    "https://*/*"
  ],
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  },
  "minimum_chrome_version": "130"
}

/** @param {'chrome' | 'firefox'} [browser] */
export const createManifest = (browser = 'chrome') => {
  if (browser === 'chrome') return defineManifest(manifest)
  const { minimum_chrome_version, side_panel, ...shared } = manifest
  return defineManifest({
    ...shared,
    background: { scripts: ['src/background/service-worker.js'], type: 'module' },
    permissions: [...shared.permissions.filter(permission => !['offscreen', 'sidePanel'].includes(permission)), 'clipboardWrite'],
    ...{ sidebar_action: { default_panel: 'src/sidepanel/index.html', default_title: 'SUP 5th — SEO', open_at_install: false } },
    browser_specific_settings: {
      ...{ gecko_android: { strict_min_version: '142.0' } },
      gecko: {
        id: 'sup5th@5th.ru',
        strict_min_version: '140.0',
        data_collection_permissions: { required: ['authenticationInfo', 'browsingActivity'] }
      }
    }
  })
}

export default createManifest()

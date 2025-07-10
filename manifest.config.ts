import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json";

// https://crxjs.dev/vite-plugin/concepts/manifest
export default defineManifest({
  manifest_version: 3,
  name: "Sup5th",
  version: pkg.version,
  description: pkg.description,
  icons: {
    48: "public/logo.png",
  },
  permissions: ["storage", "activeTab"],
  host_permissions: ["<all_urls>"],
  action: {
    default_icon: {
      48: "public/logo.png",
    },
    default_popup: "src/popup/index.html",
  },
  content_scripts: [
    {
      js: ["src/content/widget/index.ts"],
      matches: ["<all_urls>"],
    },
    {
      js: ["src/content/support/index.ts"],
      matches: ["https://support.5th.ru/*"],
    },
  ],
  background: {
    service_worker: "src/background/main.ts",
    type: "module",
  },
  web_accessible_resources: [
    {
      matches: [
        "<all_urls>"
      ],
      resources: ["*", "*.js", "*.css", "assets/*"]
    }
  ]
});

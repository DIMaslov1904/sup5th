import { fileURLToPath } from "url"
import { dirname, resolve } from "path"
import { crx } from "@crxjs/vite-plugin"
import tailwindcss from "@tailwindcss/vite"
import vue from "@vitejs/plugin-vue"
import { defineConfig } from "vite"
import manifest from "./manifest.json" with { type: "json" }

const rootDir = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [vue(), tailwindcss(), crx({ manifest })],
  resolve: {
    alias: {
      "@": resolve(rootDir, "src")
    }
  },
  server: {
    watch: {
      usePolling: true
    }
  }
})

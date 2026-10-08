import { fileURLToPath } from "url"
import { dirname, resolve } from "path"
import { crx } from "@crxjs/vite-plugin"
import tailwindcss from "@tailwindcss/vite"
import vue from "@vitejs/plugin-vue"
import { defineConfig } from "vite"
import zipPack from "vite-plugin-zip-pack"
import manifest from "./manifest.json" with { type: "json" }

const rootDir = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    crx({ manifest }),
    zipPack({
      inDir: 'dist',
      outDir: 'dist-zip',
      outFileName: `sup5th-v${manifest.version}.zip`
    })
  ],
  resolve: {
    alias: {
      "@": resolve(rootDir, "src")
    }
  },
  build: {
    modulePreload: false,
    rollupOptions: {
      input: {
        "src/seo/index": resolve(rootDir, "src/seo/index.html")
      }
    }
  },
  server: {
    watch: {
      usePolling: true
    }
  }
})

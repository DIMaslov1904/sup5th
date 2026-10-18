import { fileURLToPath } from "url"
import { dirname, resolve } from "path"
import { crx } from "@crxjs/vite-plugin"
import tailwindcss from "@tailwindcss/vite"
import vue from "@vitejs/plugin-vue"
import { defineConfig } from "vite"
import zipPack from "vite-plugin-zip-pack"
import manifest from "./manifest.config.mjs"

const rootDir = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    crx({ manifest }),
    zipPack({
      inDir: 'dist',
      outDir: 'release',
      outFileName: `sup5th-v${manifest.version}.zip`
    })
  ],
  resolve: {
    alias: {
      "@": resolve(rootDir, "src")
    }
  },
  build: {
    rolldownOptions: {
      input: { 'src/offscreen/index': resolve(rootDir, 'src/offscreen/index.html') }
    },
    modulePreload: false
  },
  server: {
    watch: {
      usePolling: true
    }
  }
})

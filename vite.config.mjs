import { fileURLToPath } from "url"
import { dirname, resolve } from "path"
import { crx } from "@crxjs/vite-plugin"
import tailwindcss from "@tailwindcss/vite"
import vue from "@vitejs/plugin-vue"
import { defineConfig } from "vite"
import zipPack from "vite-plugin-zip-pack"
import { createManifest } from "./manifest.config.mjs"

const rootDir = dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  const browser = mode === 'firefox' ? 'firefox' : 'chrome'
  const manifest = createManifest(browser)
  const outDir = browser === 'firefox' ? 'dist-firefox' : 'dist'
  return {
    plugins: [
      vue(),
      tailwindcss(),
      crx({ manifest, browser }),
      zipPack({
        inDir: outDir,
        outDir: 'release',
        outFileName: browser === 'firefox' ? `sup5th-firefox-v${manifest.version}.zip` : `sup5th-chromium-v${manifest.version}.zip`
      })
    ],
    resolve: {
      alias: {
        "@": resolve(rootDir, "src")
      }
    },
    build: {
      outDir,
      rolldownOptions: {
        input: {
          'src/sidepanel/index': resolve(rootDir, 'src/sidepanel/index.html'),
          'src/biometric/index': resolve(rootDir, 'src/biometric/index.html'),
          'src/biometric/diagnostics': resolve(rootDir, 'src/biometric/diagnostics.html'),
          ...(browser === 'chrome'
            ? { 'src/offscreen/index': resolve(rootDir, 'src/offscreen/index.html') }
            : {})
        }
      },
      modulePreload: false
    },
    server: {
      watch: {
        usePolling: true
      }
    }
  }
})

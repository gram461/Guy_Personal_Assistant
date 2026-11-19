import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Lets tests use the same "@/..." import paths as the website's own code.
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
})

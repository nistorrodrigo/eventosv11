/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Vitest config: keep Playwright e2e specs out — they require the Playwright runner.
  test: {
    exclude: ['node_modules/**', 'e2e/**', 'dist/**'],
  },
})

/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./client/src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'client/src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/index.html',
        '**/vite.config.ts',
        '**/vitest.config.ts',
        '**/postcss.config.js',
        '**/tailwind.config.js',
        '**/components.json',
        '**/drizzle.config.ts',
        '**/script/',
        '**/firebase.json',
        '**/firestore.indexes.json',
        '**/firestore.rules',
        '**/firestore.rules.test.ts',
        '**/vite-plugin-meta-images.ts',
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    },
  },
})
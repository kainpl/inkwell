import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: 'src/renderer',
  plugins: [react()],
  resolve: {
    alias: { '@renderer': resolve('src/renderer/src'), '@shared': resolve('src/shared') }
  },
  server: { host: '127.0.0.1', port: 1420, strictPort: true },
  build: { outDir: resolve('dist'), emptyOutDir: true }
})

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

const root = fileURLToPath(new URL('.', import.meta.url))
const useHttps = process.env.HTTPS === 'true'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    ...(useHttps ? [basicSsl()] : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(root, 'src'),
    },
  },
  server: {
    host: '::',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        timeout: 120000,
        configure: (proxy) => {
          proxy.on('error', (err, _req, res) => {
            if (res && !res.headersSent) {
              res.writeHead(502, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ detail: `FastAPI backend on port 8000 is unreachable: ${err.message}` }))
            }
          })
        },
      },
      '/health': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        timeout: 30000,
      },
    },
  },
  preview: {
    host: '::',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        timeout: 120000,
      },
      '/health': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        timeout: 30000,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@mui') || id.includes('@emotion')) return 'vendor-mui'
            if (id.includes('lucide-react')) return 'vendor-lucide'
            if (id.includes('recharts') || id.includes('d3')) return 'vendor-charts'
            if (id.includes('xlsx')) return 'vendor-xlsx'
          }
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
})

/* global process */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

const root = fileURLToPath(new URL('.', import.meta.url))

// The React app talks to the FastAPI backend through /api (and /health for the KPI desk).
// In development Vite proxies them to VITE_API_PROXY (default http://127.0.0.1:8000),
// so the browser only ever sees one origin.
// The dev server uses HTTPS (self-signed) so phones on the Wi-Fi may use location and camera
// (attendance QR, webcam capture). Set VITE_HTTPS=false in frontend/.env for plain http.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const api = env.VITE_API_PROXY || 'http://127.0.0.1:8000'
  return {
    plugins: [react(), tailwindcss(), ...(env.VITE_HTTPS === 'false' ? [] : [basicSsl()])],
    resolve: {
      alias: {
        '@': path.resolve(root, 'src'),
      },
    },
    server: {
      host: true, // reachable from phones on the same Wi-Fi (https://<laptop-ip>:5173)
      port: 5173,
      proxy: {
        '/api': {
          target: api,
          changeOrigin: true,
          timeout: 120000,
          configure: (proxy) => {
            proxy.on('error', (err, _req, res) => {
              if (res && !res.headersSent) {
                res.writeHead(502, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ detail: `FastAPI backend at ${api} is unreachable: ${err.message}` }))
              }
            })
          },
        },
        '/health': { target: api, changeOrigin: true, timeout: 30000 },
      },
    },
    preview: {
      host: true,
      port: 5173,
      proxy: {
        '/api': { target: api, changeOrigin: true, timeout: 120000 },
        '/health': { target: api, changeOrigin: true, timeout: 30000 },
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
  }
})

/* global process */
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The React app talks to the FastAPI backend through /api.
// In development Vite proxies /api to VITE_API_PROXY (default http://127.0.0.1:8000),
// so the browser only ever sees one origin.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: true, // reachable from phones on the same Wi-Fi (http://<laptop-ip>:5173)
      port: 5173,
      proxy: {
        '/api': { target: env.VITE_API_PROXY || 'http://127.0.0.1:8000', changeOrigin: true },
      },
    },
  }
})

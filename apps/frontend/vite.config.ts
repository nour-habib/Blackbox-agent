import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  server: {
    proxy: {
      // Forward dashboard API calls to apps/backend (default :4001).
      // The backend host can be overridden via VITE_API_PROXY at dev time.
      '/api': {
        target: process.env.VITE_API_PROXY ?? 'http://localhost:4001',
        changeOrigin: true,
      },
    },
  },
})

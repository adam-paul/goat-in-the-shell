import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  preview: {
    allowedHosts: [
      'goat-in-the-shell-demo.up.railway.app',
      '.railway.app', // This will allow all railway.app subdomains
    ],
  },
})

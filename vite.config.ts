import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Define environment variables that will be available in the client code
    'import.meta.env.VITE_SERVER_PORT': JSON.stringify(process.env.SERVER_PORT || 3001),
  },
  preview: {
    allowedHosts: [
      'goat-in-the-shell-demo.up.railway.app',
      '.railway.app', // This will allow all railway.app subdomains
    ],
  },
})

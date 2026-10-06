import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Repassa as chamadas da API para o back-end ASP.NET (perfil "http" do launchSettings.json).
    proxy: {
      '/api': 'http://localhost:5193',
    },
  },
})

// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/my-clock-app/', // el nombre exacto del repo
  plugins: [react()],
})
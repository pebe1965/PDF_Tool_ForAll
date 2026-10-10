import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // Allows accessing from iPad on local network!
    watch: {
      ignored: ['**/PDF_Tool_ForAll.app/**', '**/dist/**', '**/*.dmg', '**/*.zip', '**/.git/**']
    }
  },
  optimizeDeps: {
    include: ['pdfjs-dist', 'pdf-lib']
  }
})

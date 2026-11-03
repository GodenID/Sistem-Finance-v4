import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true
  },
  build: {
    target: 'esnext', // Use modern JS for smaller bundle size
    minify: 'esbuild', // Faster and good enough minification
    chunkSizeWarningLimit: 1000, // Increase warning limit for chunks
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React libraries
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Ikon dipakai Sidebar/Header sejak awal, jadi ikut chunk awal.
          'vendor-ui': ['lucide-react'],
          // recharts, jspdf, jszip, dan file-saver sengaja TIDAK dipatok di sini:
          // manualChunks menggabungkan semuanya jadi satu chunk, sehingga
          // recharts/jspdf (berat, hanya dipakai halaman detail/laporan) ikut
          // terunduh di load pertama. Biarkan Rollup memecahnya per halaman.
          // Backend/Data handling
          'vendor-data': ['axios']
        }
      }
    }
  }
})



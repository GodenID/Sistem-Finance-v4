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
          // UI Components & Icons
          'vendor-ui': ['lucide-react', 'recharts'],
          // Heavy libraries (PDF & Excel)
          // NOTE (FIX #5): 'xlsx' sengaja TIDAK dicantumkan agar hasil
          // `await import('xlsx')` menjadi chunk on-demand tersendiri,
          // bukan ikut vendor-utils yang dimuat di awal rute.
          'vendor-utils': ['jspdf', 'jszip', 'file-saver'],
          // Backend/Data handling
          'vendor-data': ['@supabase/supabase-js', 'axios']
        }
      }
    }
  }
})



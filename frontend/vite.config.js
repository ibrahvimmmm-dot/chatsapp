import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      // Proxy API calls to backend during development
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      },
      // Proxy Socket.IO for development
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          socket: ['socket.io-client']
        }
      }
    }
  },
  // Use relative paths for production
  base: './'
})
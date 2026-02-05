import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Check if we're in production
const isProduction = process.env.NODE_ENV === 'production';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
        changeOrigin: true,
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Don't minify to avoid terser issues
    minify: isProduction ? 'terser' : false,
    terserOptions: isProduction ? {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    } : undefined,
    rollupOptions: {
      input: './index.html',
      output: {
        manualChunks: undefined
      }
    }
  },
  // In production, use relative paths
  base: isProduction ? './' : '/'
})
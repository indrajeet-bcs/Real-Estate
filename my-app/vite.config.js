import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // Split heavy third-party libs out of the main app chunk so the initial
        // bundle is smaller and vendors cache separately across deploys.
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) return 'react-vendor'
            return 'vendor'
          }
        },
      },
    },
  },
  server: {
    proxy: {
      // Proxy API calls to the Express backend during development.
      '/api': {
        target: 'http://127.0.0.1:5001',
        changeOrigin: true,
      },
      // Uploaded files (receipts, proofs, legal docs) are served by Express at
      // /uploads — proxy them too, otherwise attachment/link clicks 404 on Vite.
      '/uploads': {
        target: 'http://127.0.0.1:5001',
        changeOrigin: true,
      },
    },
  },
})

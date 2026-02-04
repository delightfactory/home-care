import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

// Plugin لحقن timestamp في Service Worker تلقائياً عند البناء
const swVersionPlugin = (): Plugin => ({
  name: 'sw-version-plugin',
  writeBundle() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const swPath = path.resolve(__dirname, 'dist/sw.js');

    if (fs.existsSync(swPath)) {
      let content = fs.readFileSync(swPath, 'utf-8');
      content = content.replace(/__BUILD_TIMESTAMP__/g, timestamp);
      fs.writeFileSync(swPath, content);
      console.log(`✅ SW version updated to: ${timestamp}`);
    }
  }
});

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), swVersionPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      react: path.resolve(__dirname, './node_modules/react'),
      'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
    },
  },
  define: {},
  server: {
    port: 3000,
    host: true
  },
  build: {
    // PWA optimizations
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          ui: ['@headlessui/react', '@heroicons/react', 'lucide-react'],
          supabase: ['@supabase/supabase-js'],
          utils: ['react-hot-toast', '@tanstack/react-query']
        }
      }
    },
    // Enable source maps for better debugging
    sourcemap: true,
    // Optimize chunk size
    chunkSizeWarningLimit: 1000,
    // Enable minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  },
  // PWA specific configurations
  publicDir: 'public',
  base: '/',
  // Enable HTTPS for PWA features in development
  preview: {
    port: 3000,
    host: true,
    https: false // Set to true if you have SSL certificates
  }
})

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    hmr: process.env.DISABLE_HMR !== 'true',
  },
  preview: {
    host: '0.0.0.0',
    port: 3001,
  },
  build: {
    chunkSizeWarningLimit: 5000,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      }
    },
  }
});

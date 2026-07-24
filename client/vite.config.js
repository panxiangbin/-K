import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/ws': { target: 'ws://localhost:3002', ws: true },
    },
  },
  build: {
    outDir: 'dist',
    manifest: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react-vendor';
          }
          return undefined;
        },
      },
    },
  },
});
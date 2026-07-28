import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const isGitHubPages = process.env.DEPLOY_TARGET === 'github-pages';
const requestedPagesBase = String(process.env.PAGES_BASE_PATH || '/-K/').trim();
const githubPagesBase = requestedPagesBase.startsWith('/')
  ? requestedPagesBase
  : `/${requestedPagesBase}`;
const normalizedGitHubPagesBase = githubPagesBase.endsWith('/')
  ? githubPagesBase
  : `${githubPagesBase}/`;

const githubPagesRuntimePlugin = {
  name: 'henan-50k-github-pages-runtime',
  enforce: 'pre',
  transform(code, id) {
    if (!isGitHubPages) return null;
    const normalizedId = String(id || '').replace(/\\/g, '/');

    if (normalizedId.endsWith('/src/hooks/useWebSocket.js')) {
      const original = "if (protocol === 'capacitor:') return RENDER_URL;";
      const replacement = "if (protocol === 'capacitor:' || hostname.endsWith('.github.io')) return RENDER_URL;";
      if (!code.includes(original)) throw new Error('GitHub Pages WebSocket 接入点已变化');
      return { code: code.replace(original, replacement), map: null };
    }

    if (normalizedId.endsWith('/src/App.jsx')) {
      const original = "const RECORDED_BOMB_AUDIO_SRC = '/audio/langaishou-v2.mp3';";
      const replacement = "const RECORDED_BOMB_AUDIO_SRC = `${import.meta.env.BASE_URL}audio/langaishou-v2.mp3`;";
      if (!code.includes(original)) throw new Error('GitHub Pages 音频路径接入点已变化');
      return { code: code.replace(original, replacement), map: null };
    }

    return null;
  },
};

export default defineConfig({
  base: isGitHubPages ? normalizedGitHubPagesBase : '/',
  plugins: [react(), githubPagesRuntimePlugin],
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

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Tauri serves the window from this dev server, and from `dist` in a build.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 5273,
    strictPort: true,
    watch: { ignored: ['**/src-tauri/**', '**/target/**'] },
  },
  build: {
    target: 'chrome105',
    sourcemap: false,
    // Monaco and xterm are imported only where they are shown; keeping them
    // in separate chunks is what keeps the first paint small.
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
});

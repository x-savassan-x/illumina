import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';


export default defineConfig({
  plugins: [react()],
  root: resolve(__dirname, 'src', 'webview'),
  base: './',
  build: {
    outDir: resolve(__dirname, 'dist', 'webview'),
    emptyOutDir: true
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src', 'shared')
    }
  }
});

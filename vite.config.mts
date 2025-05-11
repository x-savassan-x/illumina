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
      '@webview': resolve(__dirname, 'src', 'webview'),
      '@shared': resolve(__dirname, 'src', 'shared')
    }
  }
});

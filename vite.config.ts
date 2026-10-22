import { defineConfig } from 'vite';

// base: './' 让构建产物能在 GitHub Pages 的任意子路径下运行
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
});

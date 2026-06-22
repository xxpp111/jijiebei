import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// admin/ 独立 Arco B 端子应用（与展示层 web/ 物理隔离，零碰 SC2 三皮肤 token）。
// /api 反代本地 PocketBase 8090（同源免 CORS，对齐 web/vite.config.ts 与生产 deploy/nginx）。
// base=/admin/：生产 nginx location /admin 段托管 build 产物（admin/dist）。
export default defineConfig({
  plugins: [react()],
  base: '/admin/',
  server: {
    port: 7790,
    proxy: { '/api': 'http://127.0.0.1:8090' },
  },
  preview: {
    port: 7790,
    proxy: { '/api': 'http://127.0.0.1:8090' },
  },
  build: { outDir: 'dist', target: 'es2020', sourcemap: false },
});

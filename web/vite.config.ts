import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// P0 架构清场后 web/ 自包含：旧引擎逻辑已复制进 src/logic/legacy/（assets/Script Cocos 原件冻结只读），
// 不再有 @logic/@jjb 跨界 alias。注：designAssets.ts 仍 glob ../design/v4-r2（设计真相源，合法外部依赖），
// 故 server.fs.allow 保留仓库根以便 dev 服务 design/ 资源；build 期 glob 已编译捆绑、不依赖 fs.allow。
export default defineConfig({
  plugins: [react()],
  server: {
    port: 7788,
    fs: { allow: [resolve(__dirname, '..')] },
    allowedHosts: ['.trycloudflare.com'], // cloudflared quick tunnel 公网测试放行（jjb-run-broadcast）
    // P5 联调：/api 反代到本地 PocketBase 8090（同源免 CORS，对齐生产 deploy/nginx-api.conf）
    proxy: { '/api': 'http://127.0.0.1:8090' },
  },
  preview: {
    port: 7788,
    allowedHosts: ['.trycloudflare.com'],
    proxy: { '/api': 'http://127.0.0.1:8090' },
  },
  build: { outDir: 'dist', target: 'es2020' },
});

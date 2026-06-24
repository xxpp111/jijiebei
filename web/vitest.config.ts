import { defineConfig } from 'vitest/config';

// 集结杯 web 代码层单测（测试体系第①层）。
// node env：纯逻辑断言，不渲染 React（React 组件回归仍以 jjb-verify 四套 Playwright 为准）。
// import.meta.glob（jjbSession 编译期捆绑 web/src/data/jjdata/*.txt）由 vitest 内置 Vite 提供，零额外打包——
// 与 e2e/{codec,run}.mjs 的 Vite SSR 加载同款，复用而非另造。
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/logic/__tests__/*.test.ts'],
    setupFiles: ['src/logic/__tests__/setup.ts'],
  },
});

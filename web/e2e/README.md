# 集结杯 e2e 测试

> **覆盖矩阵唯一真相源 = `docs/testing.md` §3**（16 个流程脚本 + 7 条 AI-E2E flow 各测什么、需不需要后端，都在那里，本文件不重复维护清单）。

两类测试，配合 vitest 单测（`src/logic/__tests__/`）形成回归网：

```bash
# ① 流程脚本（纯 Node，各自独立）
node e2e/<name>.mjs                   # 如 run.mjs / codec.mjs / bp-rules.mjs

# ② AI-E2E flow（Playwright，自带 preview + chrome 生命周期）
npm run build -s                      # dist 必须最新，否则跑的是旧 bundle
node e2e/flows/<name>.flow.mjs        # 截图落 /tmp/jjb-flow-<name>.png
```

**加新 flow**：`flows/<name>.flow.mjs` → `import { withPreview, expect, done, shot } from '../lib/harness.mjs'` → `withPreview(async (page,{baseUrl})=>{...})` + `done('<name>')`。断言纪律（`__jjbDebug`/DOM 硬断言、截图目检、落库类 curl 后端 Δ）见 `docs/testing.md` §7。

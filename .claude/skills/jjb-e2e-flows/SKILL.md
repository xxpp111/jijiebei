---
name: jjb-e2e-flows
description: 集结杯 web 流程化 AI-E2E。每条 flow = 导航 + 交互 + __jjbDebug/DOM 断言 + 截图。要验证某条比赛流程端到端、出回归截图、或加新流程测试时使用。不用于纯逻辑单测（那是 vitest 与 e2e/*.mjs 脚本的事）。
---

# 集结杯 AI-E2E flows

把比赛流程沉淀成可重复跑的 Playwright flow，每条独立、自带断言 + 截图，配合 vitest 单测形成回归网。

> **清单与纪律唯一真相源 = `docs/testing.md`**：§3 覆盖矩阵（哪些 flow、各测什么、需不需要 P5 后端），§7 测试约定 + 断言纪律（硬断言 / 禁 magic number / 落库 curl Δ 等）。本 skill 不重复维护清单，只留跑法。

## 跑法

```bash
cd web && npm run build -s          # dist 必须最新，否则跑的是旧 bundle
node e2e/flows/<name>.flow.mjs       # 公共件 e2e/lib/harness.mjs 自动起 preview + chrome + cleanup
```

公共件 `e2e/lib/harness.mjs` 提供：`withPreview(fn)`（起 preview+launch+自动 cleanup）、`expect/pass/fail/done`（断言+退出码）、`shot(page,name)`（截图到 `/tmp/jjb-flow-<name>.png`）。

## 前置

- 纯渲染 flow 不需后端；登录/落库类 flow 需 P5（`127.0.0.1:8090` + `seed-hosts.sh` 录主播）；公网联调用 `JJB_API=<tunnel>/api` 覆盖基址。各 flow 归属见 testing.md §3。

## 加新 flow

1. `e2e/flows/<name>.flow.mjs`，`import { withPreview, expect, done, shot } from '../lib/harness.mjs'`。
2. `withPreview(async (page, {baseUrl}) => { ...断言... })` + `done('<name>')`。
3. 守 testing.md §7 断言纪律：`__jjbDebug`/DOM 硬断言 + 截图目检；落库类 curl 后端基线对比 Δ。
4. 写完把该 flow 补进 testing.md §3 覆盖矩阵（唯一清单，别落回本 skill）。

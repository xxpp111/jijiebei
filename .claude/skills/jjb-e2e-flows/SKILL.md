---
name: jjb-e2e-flows
description: 集结杯 web 流程化 AI-E2E。每条 flow = 导航 + 交互 + __jjbDebug/DOM 断言 + 截图。覆盖 登录/单刷一局/天梯分榜/录入→算分。要验证某条比赛流程端到端、出回归截图、或加新流程测试时使用。不用于纯逻辑单测（那是 vitest e2e/*.test 的事）。
---

# 集结杯 AI-E2E flows

把比赛流程沉淀成可重复跑的 Playwright flow，每条独立、自带断言 + 截图，配合 vitest 单测（第①层）形成完整回归网。

## 跑法

```bash
cd web && npm run build -s          # dist 必须最新
node e2e/flows/<name>.flow.mjs       # 公共件 e2e/lib/harness.mjs 自动起 preview + 起 chrome + cleanup
```

公共件 `e2e/lib/harness.mjs` 提供：`withPreview(fn)`（起 preview+launch+自动 cleanup）、`expect/pass/fail/done`（断言+退出码）、`shot(page,name)`（截图到 `/tmp/jjb-flow-<name>.png`）。新 flow 只写「导航+交互+断言+截图」。

## 断言纪律（继承 jjb-verify，不可省）

- **不许只看 HTTP200/无 error**：每条 flow 必有 `__jjbDebug` 或 DOM count 硬断言。
- **截图必目检**：存 `/tmp/jjb-flow-<name>.png`，关键态肉眼看一眼。
- **落库类必 curl 后端基线**：matches/scores/rankings 的 Δ 对比，不只信前端 console（见 record-to-score）。

## flow 清单

| flow | 断言点 | 截图 | 需 P5 |
|---|---|---|---|
| `login.flow` | login-stage + 三族×3 + 账号/密码/登录按钮 + 登录歪比 success | login | 登录段需 |
| `single-match.flow` | home比赛tab登录入口 + select 3槽 + battle 判定改 __jjbDebug.score | single-* | 否 |
| `ladder.flow` | 分榜 3 tab + 切换 on + ranked/empty 稳定态 | ladder-* | 否(empty兜底) |
| `doubles-match.flow` | 官突 factorPool=9 抽 CSV + 非酋 factorPool=3 + commanderPool=6 | doubles-* | 否 |
| `doubles-sync.flow` | 两主播同时落库各成功 + 后端各落一条不串（双打多端独立性探测）| — | **需** |
| `record-to-score.mjs` | 兜底建 player → scores 派生 → rankings count>0 + 幂等 | — | **需**（`JJB_API=<公网>/api`）|

> 双打落库 mode-agnostic（比赛 tab 进双打即落库 game_mode=doubles）；双打单端闭包态无 UI 多端同步（doubles-sync 仅探测后端独立性，「两主播判同一局」须服务端合流=产品决策项）。

## 前置

- `npm run build`（dist 最新，否则跑的是旧 bundle）。
- 纯渲染 flow（single-match/ladder）不需后端。
- 登录/录入 flow 需 P5（`127.0.0.1:8090` + `seed-hosts.sh` 录主播）；公网联调用 `JJB_API` 覆盖基址。

## 加新 flow

1. `e2e/flows/<name>.flow.mjs`，`import { withPreview, expect, done, shot } from '../lib/harness.mjs'`。
2. `withPreview(async (page, {baseUrl}) => { ...断言... })` + `done('<name>')`。
3. 落库类记得 curl 后端基线对比 Δ。

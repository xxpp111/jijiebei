# 集结杯 e2e 测试

两类测试，配合 vitest 单测（`src/logic/__tests__/`）形成回归网。

## 1. 流程脚本（`*.mjs`）— 既有

纯 node 脚本（非 test runner），各自 `node e2e/<name>.mjs` 跑：

| 脚本 | 测什么 |
|---|---|
| `codec.mjs` | 9 模式 + 双打码往返等价 + 三道闸 + 越界拦截 |
| `applysnapshot.mjs` | 单/双打 applySnapshot 还原往返深比对 |
| `run.mjs` | 9 模式池=槽恒等式 + 9 格契约 + 双打全路径 |
| `bp-rules.mjs` | BP 规则 done-when 1-6 |
| `random-enemy.mjs` | 随机敌方开关/分布 |
| `r6-doubles-downstream.mjs` | 双打下游三屏 |
| `ui-smoke.mjs` | React DOM smoke |
| `record-to-score.mjs` | 兜底建 player→scores 派生→rankings（落库链路，公网用 `JJB_API=<tunnel>/api`）|

## 2. AI-E2E flows（`flows/*.flow.mjs`）— 流程化

每条 flow = 导航 + 交互 + `__jjbDebug`/DOM 硬断言 + 截图，共用 `lib/harness.mjs`（自动起 preview + 起 chrome + cleanup）。

```bash
npm run build -s                      # dist 必须最新
node e2e/flows/<name>.flow.mjs        # 自带 preview/浏览器生命周期
```

| flow | 断言点 | 截图 | 需 P5 |
|---|---|---|---|
| `login.flow` | login-stage + 三族×3 + 账号/密码/登录按钮 + 登录歪比 success | login | 登录段需 |
| `single-match.flow` | home 比赛 tab 登录入口 + select 3 槽 + battle 判定改 `__jjbDebug.score` | single-* | 否 |
| `ladder.flow` | 分榜 3 tab + 切换 on + ranked/empty 稳定态 | ladder-* | 否 |

**断言纪律**：不许只看 HTTP200/无 error，每条必有 `__jjbDebug`/DOM count 硬断言 + 截图目检；落库类必 curl 后端基线对比 Δ。

**加新 flow**：`flows/<name>.flow.mjs` → `import { withPreview, expect, done, shot } from '../lib/harness.mjs'` → `withPreview(async (page,{baseUrl})=>{...})` + `done('<name>')`。

> 本机装了 `jjb-e2e-flows` skill（`.claude/skills/`，gitignored）同样描述这套流程；本 README 是进 git 的团队版。

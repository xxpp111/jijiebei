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
| `auth-perm.mjs` | player_accounts 权限矩阵：注册 createRule 放开 / 选手 list 只看自己 / 匿名挡 / phone unique / 越权改档 404（隔离 PB）|
| `backend-integ.mjs` | P5 联调：host auth→postMatch→hook 派生 scores→天梯增量全链路（需 vite dev+PocketBase 在跑）|
| `event-ban.mjs` | 赛事临时 ban 逻辑层（Phase3）：单/双打地图·因子·官突 ban + while 守卫（Vite SSR 纯逻辑断言）|
| `match-flow.mjs` | P5 联调端到端：真实 UI 比赛流程（登录→选人→开局→判定→落库→选手关联→hook 派生 scores），需 vite dev+PocketBase 在跑 |
| `player-hook.mjs` | player_accounts→players 自动建 hook：注册自动建 / relation 回设 / 重复 phone 不重复建 / 预绑幂等（隔离 PB 真验）|
| `practice-post.mjs` | practice 落库权限矩阵：选手自助落 practice 放开 / match 仍限 host / 匿名挡 / practice 落库不派生 scores（隔离 PB）|
| `register-privacy.mjs` | 记住我默认勾选 + 隐私协议注册门（未勾协议前端拦截，纯前端 vite preview）|
| `reroll.mjs` | 因子「重新揉」专项门：限次 / 不重复 / 难度实时重算（池候选 + 已落槽手选两种落点，Vite SSR）|

## 2. AI-E2E flows（`flows/*.flow.mjs`）— 流程化

每条 flow = 导航 + 交互 + `__jjbDebug`/DOM 硬断言 + 截图，共用 `lib/harness.mjs`（自动起 preview + 起 chrome + cleanup）。

```bash
npm run build -s                      # dist 必须最新
node e2e/flows/<name>.flow.mjs        # 自带 preview/浏览器生命周期
```

| flow | 断言点 | 截图 | 需 P5 |
|---|---|---|---|
| `login.flow` | login-stage + 三族×3 + 账号/密码/登录按钮 + 登录歪比 success | login | 登录段需 |
| `auth.flow` | 注册屏 22 指挥官+4 字段渲染→填表→success banner 真落库 + 登录屏默认选手 tab + 记住我→localStorage 持久 + 主播 tab 切换 | auth-* | 否 |
| `login-gate.flow` | 未登录点开局→引导 login + 直接 URL ?screen=select 被路由守卫踢回 home + obs/ladder 公开读红线不踢 home + 登录后放行进 select | login-gate-* | 否 |
| `single-match.flow` | home 比赛 tab 登录入口 + select 3 槽 + battle 判定改 `__jjbDebug.score` | single-* | 否 |
| `ladder.flow` | 分榜 3 tab + 切换 on + ranked/empty 稳定态 | ladder-* | 否 |
| `doubles-match.flow` | 官突 factorPool=9 抽 CSV + 非酋 factorPool=3 + commanderPool=6（落库链路见下）| doubles-* | 否 |
| `doubles-sync.flow` | 两主播同时落库各成功 + 后端各落一条不串不丢（双打多端独立性探测）| — | **需** |

> **双打落库**：前端 `maybePostMatch` 是 mode-agnostic，比赛 tab 进双打（5/6 号位）即 match 态落库 `game_mode=doubles/feiqiu-doubles`，hook 派生 scores 进双打榜。`doubles-sync` 探测结论：双打是单端闭包态，UI 层无多端同步合流——「两主播判同一局」须服务端合流，当前架构不支持（产品决策项）。

**断言纪律**：不许只看 HTTP200/无 error，每条必有 `__jjbDebug`/DOM count 硬断言 + 截图目检；落库类必 curl 后端基线对比 Δ。

**加新 flow**：`flows/<name>.flow.mjs` → `import { withPreview, expect, done, shot } from '../lib/harness.mjs'` → `withPreview(async (page,{baseUrl})=>{...})` + `done('<name>')`。

> 本机装了 `jjb-e2e-flows` skill（`.claude/skills/`，gitignored）同样描述这套流程；本 README 是进 git 的团队版。

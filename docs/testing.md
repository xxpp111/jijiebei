# 集结杯 · 测试体系（Testing）

> 范围：项目四层测试体系——①代码层（前端 build / 后端 Go）②AI-E2E（Playwright + 纯 Node fetch + flows）③双打同步（两 profile 对战）④vitest 单元测试（纯函数 / 状态机）。
> 真相源：`web/e2e/*.mjs`（20 个前端 e2e）+ `web/e2e/flows/*.flow.mjs`（7 条 AI-E2E flow）+ `web/src/logic/__tests__/*.test.ts`（12 个 vitest 单测文件）+ `admin/e2e/admin-smoke.mjs`（后台 e2e）+ `backend/verify-all.sh`（后端全链路）。

---

## 0. 四层测试体系总览

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ④ vitest 单元测试（纯函数 / 状态机，最快、无需 build）                      │
│     · web/src/logic/__tests__/：12 文件 126 用例（backend / codec /            │
│       commanderWeight / eventBan / goldRuntime / jjbSession / matchRecord /  │
│       mutatorPool / visual-diff）                                             │
│     · npm run test:unit（vitest run）                                        │
├──────────────────────────────────────────────────────────────────────────────┤
│  ③ 双打同步（端到端 + 两 profile 对战）                                      │
│     · web/e2e/r6-doubles-downstream.mjs                                      │
│     · 验证：双打局 → 落库 → 派生 scores → 选手关联                           │
│     · 依赖：dev 7788 + PB 8090 + 数据已造                                    │
├──────────────────────────────────────────────────────────────────────────────┤
│  ② AI-E2E（Playwright + 纯 Node fetch + flows）                              │
│     · 浏览器：match-flow / r6-doubles-downstream / ui-smoke /                │
│       register-privacy                                                       │
│     · 纯逻辑（Vite SSR，7 个）：run / codec / bp-rules / random-enemy /      │
│       applysnapshot / event-ban / reroll                                     │
│     · fetch：backend-integ / record-to-score                                 │
│     · 隔离 PB（自起临时实例）：auth-perm / practice-post / player-hook       │
│       · 真 UI+真隔离 PB（/api 真代理不 mock）：record-fullstack              │
│     · flows（自然语言驱动：导航+交互+断言+截图）：web/e2e/flows/ 7 条        │
├──────────────────────────────────────────────────────────────────────────────┤
│  ① 代码层（前端 build / 后端 Go）                                            │
│     · web: npm run build（Vite + TS 0 error）                                │
│     · backend: go build / go test                                            │
│     · 启动：./pocketbase serve + migrate up                                  │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. 怎么跑（按场景分组）

### 1.1 全套前置（首次或 CI）

```bash
# 后端：编译 + 起跑 + 造数据
cd backend
go build -o pocketbase .
./pocketbase superuser upsert admin@jjb.test 'Admin123456!'   # 一次性
./pocketbase serve --http 127.0.0.1:8090 &                     # 后台跑
./verify-all.sh                                                # 造 host/viewer/players + 跑权限矩阵 + hook + 天梯
```

### 1.2 纯逻辑（无浏览器，最快）

```bash
cd web
npm install
npm run build                            # TS 编译 + 产物（run.mjs 阶段 1 依赖 dist）
node e2e/run.mjs                         # 9 模式 + 双打(含 std15/cm) + BP + 二选一 全断言（731 行）
node e2e/codec.mjs                       # 码方案编解码往返 + 三道闸
node e2e/bp-rules.mjs                    # BP 规则专项（practice/match）
node e2e/random-enemy.mjs                # 随机敌方端到端
```

> 这些走 **Vite SSR**（`createServer` + `ssrLoadModule`），不渲染 React，CI 友好。

### 1.3 浏览器 + 后端联调（需 vite dev + PB 在跑）

```bash
# 终端 1
cd web && npm run dev                    # http://localhost:7788/

# 终端 2
cd backend && ./pocketbase serve --http 127.0.0.1:8090

# 终端 3
cd web
node e2e/match-flow.mjs                  # 比赛模式真实 UI 落库（Playwright 驱动）
node e2e/backend-integ.mjs               # fetch /api 端到端（host auth → postMatch → 天梯）
node e2e/ui-smoke.mjs                    # 浏览器 UI 冒烟
```

### 1.4 双打 R6（截图 + 断言）

```bash
cd web
npm run build
node e2e/r6-doubles-downstream.mjs       # 双打下游 R6 — 3 屏 PNG + 落库断言
# 截图落到 /tmp/jjb-r6-doubles-downstream/（可配 JJB_R6_SCREENSHOT_DIR）
```

### 1.4b 落库触发链路（#94，vite preview 自起）

```bash
cd web
npm run build
node e2e/auto-post.mjs                   # 判定完成自动 POST + 改判防重 + 双打真值 + practice 静默 + 非 host 警示（mock 后端，无需 PB）
node e2e/record-fullstack.mjs            # 全栈真接缝：前端真 UI + 真隔离 isopb（/api 真代理，不 mock）→ P1 practice/#89 relation + P2 match/scores 派生 + P3 doubles 双打真机落库（#84：HomeScreen 采两名→matches.players=两 distinct 真 id→scores 两条各归两名 wins=2；backend pocketbase 已编译，自起隔离 PB 8090）
node e2e/rankings-board.mjs              # 天梯分榜 board=single/double 分流 + std15/cm 归双打榜（防遗漏事故回归网，自起隔离 PB 8090）
```

### 1.5 后台 admin

```bash
cd admin
npm install
npm run build                            # vite build（base=/admin/）
node e2e/admin-smoke.mjs                 # 三角色登录 + 守卫 + 调分
# 前提：PB 8090 在跑 + backend/verify-all.sh 已造数据
```

---

## 2. 入口矩阵（npm script）

| package.json script | 命令 | 说明 |
|---|---|---|
| `npm run dev` | `vite` | 本地开发（http://localhost:7788/） |
| `npm run build` | `vite build` | TS 编译 + 产物到 `web/dist/` |
| `npm run preview` | `vite preview --port 7788` | 预览构建产物 |
| `npm run e2e:ui` | `npm run build --silent && node e2e/ui-smoke.mjs` | UI 冒烟（构建 + 跑） |
| `npm run e2e:r6` | `npm run build --silent && node e2e/r6-doubles-downstream.mjs` | R6 双打下游 |
| `npm run e2e:core` | `build + run + codec + bp-rules + auto-post` | 纯前端引擎回归一键跑（9 模式恒等式 / 编解码往返 / BP 规则 / #94 触发链路），无需后端 |
| `npm run e2e:back` | `go build backend + build + rankings-board + practice-post + record-fullstack` | 真隔离 PB 一键跑（先重编译 backend 防二进制旧）：分榜分流 + practice 落库 + 全栈真接缝 |
| `npm run snap:visual` | `build + scripts/snap-verify.mjs` | snapDOM 视觉回归：自起 preview，固定随机源 + 每屏全新 page（防跨屏状态/随机序列残留）+ capture-until-stable（同屏连截至相邻两次逐字节一致，收敛 snapDOM 瞬态单图未就绪的二态漂移），采集 home/select/battle/result/obs 五屏 actual，与 `web/e2e/snapshots/baseline/` 做 pixelmatch；更新基线用 `npm run snap:visual -- --update` |
| `npm run test:unit` | `vitest run` | vitest 单测：`web/src/logic/__tests__/` 12 文件 126 用例 |
| `npm run test:drift` | `node scripts/drift-check.mjs` | 配置漂移守护（重跑 gen-config 比对 committed 无 diff） |
| `npm run test:back` | `cd ../backend && go test ./...` | 后端 go test |
| `npm run test` | `test:unit && test:drift && test:back` | 三段聚合 |

**push 门禁（2026-07-06 起）**：`.githooks/pre-push` 四检（web tsc + vitest + backend go build + go test，~1 分钟）
每次 `git push` 自动跑——无人值守快检，止「全靠 hub 本地记得亲跑」的单点依赖。接线（每 clone 一次）：
`git config core.hooksPath .githooks`。救急跳过：`JJB_SKIP_GATE=1 git push`（须在交付说明注明）。
完整 e2e（e2e:core/e2e:back）不进 push 门禁，留部署窗口跑。

`admin/package.json`：
- `npm run dev` / `npm run build` / `npm run preview --port 7790`
- `npm run tsc`：`tsc --noEmit`（类型检查）
- `npm run e2e:smoke`：`npm run build --silent && node e2e/admin-smoke.mjs`

---

## 3. 20 个 e2e 脚本覆盖矩阵

| 脚本 | 行数 | 类型 | 覆盖什么 | 前置 |
|---|---|---|---|---|
| **run.mjs** | 731 | Vite SSR 纯逻辑 | ① bundle 完整性 + 19 接缝标记 ② 9 模式全开局（池=槽恒等式 / 9 格契约 / status=2 / map=3 / lock=3 / manualSlots 镜像）③ 双打启动接缝 + 手选 + verdict + 难度分隔离 + std15/cm 双打专项（std15：4A2B / 池17 / 无锁定；cm：3A3B混抽 / 池14 / 恒锁风暴英雄+虚空裂隙）④ BP ban（practice 无上限 / match 上限 1 / 「超出比赛规则」 / 落槽防御 / 随机护栏 / 新局重置） ⑤ 二选一互斥（ban⊕自选：`null→ban→conflict(warn)→self`） | `npm run build`（阶段 1） |
| **codec.mjs** | 178 | Vite SSR 纯逻辑 | ① 9 单打模式 + 4 双打（官突/非酋/std15/cm）capturePayload→encode→decode 深比对 ② 三道闸（version / pool / invalid）③ 越界 idx + 随机敌方 ON 往返 + 码长报告 | `npm run build` |
| **bp-rules.mjs** | 121 | Vite SSR 纯逻辑 | 聚焦 done-when 5（双打 2A1B 不拦 + cmdPool=6）+ 6（feiqiu-doubles=locked）+ 1-4 综合 smoke | `npm run build` |
| **random-enemy.mjs** | 103 | Vite SSR 纯逻辑 | ① 开关 ON→单打/双打每场 roll 合法敌方 ② OFF→全 undefined ③ 数据 19 条 / 种族 8·6·5 / id 唯一 | `npm run build` |
| **applysnapshot.mjs** | 139 | Vite SSR 纯逻辑 | applySnapshot 还原往返闭环：capturePayload(snapA)→encode→decode→applySnapshot→capturePayload(snapC)，核心字段深比对 snapA≡snapC；覆盖 std10 单打 + doubles 双打 | `npm run build` |
| **event-ban.mjs** | 215 | Vite SSR 纯逻辑 | 赛事 ban 逻辑层：getMutatorHitCount 值 / 单打地图 ban / 单打因子 ban / 双打官突直接 ban / 双打因子关联 ban / while 守卫 | `npm run build` |
| **reroll.mjs** | 117 | Vite SSR 纯逻辑 | 因子「重新揉」专项：① 限次（practice 无限不提示 / match 每局限 3 次超出软违规不执行）② 不重复（新因子≠旧且∉当前3场已用集合）③ 难度实时重算；覆盖池候选+已落槽两种落点（std15 v1 砍 reroll，用例迁移 std10） | `npm run build` |
| **ui-smoke.mjs** | 322 | Playwright 浏览器 | React DOM 烟雾测试（产物可用性 + 关键节点挂载） | `npm run build` |
| **register-privacy.mjs** | 146 | Playwright 浏览器 | D12 记住我默认勾 + D17 隐私协议注册门：① login 屏「记住我」默认勾选 ② register 屏未勾协议→点注册被前端拦截（error banner）③ 勾选后 banner 清除 ④ 再点注册→前端门放行 | `npm run build`（vite preview 自起，无需 PB） |
| **match-flow.mjs** | 56 | Playwright + fetch | dev 登录（host）→ home match 选手 P001 → std8 开局 → 判定 3 场 → result → 落库 → 选手关联 → hook 派生 scores | dev 7788 + PB 8090 + verify-all.sh 已造 P001/P002 |
| **backend-integ.mjs** | 56 | fetch (node v23+) | host auth → postMatch → hook 派生 scores → 天梯增量（与 match-flow 不同：纯 fetch，不渲染 UI） | dev 7788 + PB 8090 |
| **record-to-score.mjs** | 103 | fetch (node v23+) | 天梯兜底落库全链路：ensurePlayer 兜底建档（getByCode 精确匹配优先/找不到以输入名建 active 选手）→ 不重复建 → postMatch → hook 派生 scores → rankings 增量 → 幂等同名累加 | dev 7788 + PB 8090 |
| **rankings-board.mjs** | 110 | 隔离 PB（自起临时实例，无需 UI） | 天梯分榜 `board=single/double` 分流回归（补 routes.go rankingsHandler 零测试缺口）：造 4 局不同 game_mode（std8 单刷 + doubles/std15/cm 双打）→ hook 派生 scores → 经真 `/api/rankings` SQL 断言：board=single 只统计单刷、board=double 只统计双打、board=all 全含。**核心**：std15/cm 必进双打榜——钉死 2026-07-03「Batch C 新双打 variant 曾遗漏出 boardCond 白名单被误判进单刷榜」事故（该测试首跑即抓到旧 `backend/pocketbase` 二进制未随源码重编译的隐患） | backend pocketbase 已编译（自起隔离 PB 8090） |
| **audit-actor.mjs** | 96 | 隔离 PB（自起临时实例，无需 UI） | #90 审计日志 `logs.actor` 填充回归（补 hooks.go match.create actor 零测试缺口）：superuser 造 host 账号 → 造 match 局（host=该账号）→ 等 hook → 用 superuser 查 `logs`（`action='match.create' && target_id=<matchId>`，logs ListRule=admin-only 必须带 superuser token）断言 **actor=host 账号 id**（填充生效）；再造 practice 局（host 空）→ 断言 **actor 为空**（无 host 保持 nil、practice 行为不变、不报错）。钉死「match.create 审计 actor 恒 nil、有壳无芯」缺口 | backend pocketbase 已编译（自起隔离 PB 8090，不碰现网 pb_data） |
| **r6-doubles-downstream.mjs** | 280 | Playwright + spawn | 双打下游 R6：3 屏 PNG 截图 + 落库断言（截图存 `/tmp/jjb-r6-doubles-downstream/`） | dev 7788 + PB 8090 |
| **auto-post.mjs** | #94 | Playwright + route mock | 落库触发链路：① 单打 3 场全判 5s 后 BattleScreen 自动 POST 一次 + chip=done ② 改判一场后局指纹不变，6s 内仍只 1 次 POST（不产生第二条 matches）③ 双打局 payload 的 result/score_total 取双打引擎真值 ④ 练习态 battle 屏不渲染任何落库 chip/警示 ⑤ 比赛态非主播账号常驻警示且判满 3 场不触发 POST；拦截 `/api/collections/{players,matches}/records` 不起真后端，只测前端触发时机与 payload | `npm run build`（vite preview 自起，无需 PB） |
| **auth-perm.mjs** | 73 | fetch (node v23+) + 隔离 PB | player_accounts 权限矩阵：① 无 auth 注册 200 ② 选手 token list totalItems=1（只看自己）③ 无 token list=0（挡匿名）④ 重复 phone 400 validation_not_unique ⑤ 选手 token 改别人档案 ≠200 改不了 | backend pocketbase 已编译（自起临时 PB 8090，不碰现网 pb_data） |
| **practice-post.mjs** | 49 | fetch (node v23+) + 隔离 PB | Step6 practice 落库权限矩阵：① 选手 token 落 mode=practice → 200 ② 选手 token 落 mode=match → ≠200（限 host/admin）③ 匿名落 practice → ≠200 | backend pocketbase 已编译（自起临时 PB） |
| **player-hook.mjs** | 116 | fetch (node v23+) + 隔离 PB | player_accounts→players 自动建 hook：① 注册选手自动建 players（nickname/player_code=pa-`<id>`）② player relation 回设 ③ 重复同 phone 不重复建 ④ 账号预绑 player 时 hook 跳过（幂等） | backend pocketbase 已编译（自起临时 PB） |
| **record-fullstack.mjs** | 298 | Playwright + 隔离 PB（真 /api 代理，不 mock） | 全栈真接缝（补 auto-post mock 后端 与 practice-post 不走 UI 之间的缺口，覆盖 #94 触发链路 × #89 relation 解析 × #84 双打两名归属）：起隔离 isopb（8090）+ vite preview（/api 真代理→8090）。**P1 practice**：API 注册真 player_account → 前端真 UI 填手机号+密码登录（非注入假 token）→ 练习 std8 → 走完 3 场判定 → 等 autoPostIfComplete 5s 缓冲自动 POST → 断言真 isopb：matches 有 practice 局（mode=practice / result=[1,2,0] / score_total=2）+ **#89**：players 指向注册 hook 建的 `pa-<accId>` 真 player id（relation 经 ensurePlayer 解析成功、未被 CreateRule 挡 4xx）+ scores 无派生（练习不进天梯）。**P2 match**：superuser 建 host 账号 → 前端真 UI 主播 tab 登录 → 比赛 std8 → chip=done → 断言真 isopb：matches 有 match 局（host=host.id）+ scores 有派生（wins=2，进正式天梯）。**P3 doubles（#84）**：复用 host 比赛态 → HomeScreen 采两名（选手A/B 两 distinct 名）→ 点双打格开局 → 双打 select 随机填 → 判定 → 断言真 isopb：matches 有 doubles 局（game_mode=doubles / result=[1,2,0] / score_total=2，走 currentMatches/currentScore 双打分流真值）+ **#84**：players=两个 distinct 真 player id（各 ensurePlayer，非单占位「双打战队」）、各解析回两名 player_code + scores 两条 board=double 派生（两名各一条、各 wins=2，两人各得分）——补 #94 事故靶心双打分支 + #84 两名归属修复在真机链路上的覆盖（P1/P2 仅 std8 单打，doublesLive 分支此前从未穿真后端）。**P4 deep-link（#84 defer）**：不经 HomeScreen 直达 `?screen=select&sessionMode=doubles` → 默认名兜底「选手A/B」→ 判定落库 → 断言两 distinct 真 player id 各解析为默认名 + scores 两条各归属（deep-link/贴码路径不回退占位单归属） | backend pocketbase 已编译（自起隔离 PB 8090，不碰现网 pb_data）+ `npm run build` |
| **admin-smoke.mjs** | 80 | fetch (node v23+) | 三角色登录 + 对局/选手/天梯/系数 fetch + role 守卫（viewer 不能读 logs，host 不能读 accounts）+ admin 调分 | PB 8090 + verify-all.sh 已造 |

### flows 覆盖矩阵（`web/e2e/flows/`，7 条 AI-E2E flow）

> 每条 flow = 导航 + 交互 + `__jjbDebug`/DOM 断言 + 截图，基建统一走 `web/e2e/lib/harness.mjs`（withPreview 自起 vite preview + Playwright chrome）。

| flow | 行数 | 类型 | 覆盖什么 | 前置 |
|---|---|---|---|---|
| **auth.flow.mjs** | 70 | Playwright + 隔离 PB | 需求1 登录权限：选手注册（22 指挥官选项+4 字段→success banner）/ 登录（默认选手 tab+success）/ 记住我持久层（localStorage 非空、sessionStorage 空）/ host tab placeholder | backend pocketbase 已编译（自起隔离 PB）+ `npm run build` |
| **login-gate.flow.mjs** | 62 | Playwright + 隔离 PB | 登录门：① 未登录点开局→引导 login ② 未登录直连 URL select→路由守卫踢回 home ④⑤ 公开读红线（未登录 obs?bare=1 / ladder 不踢 home）⑥ 登录后点开局→放行进 select | backend pocketbase 已编译（自起隔离 PB）+ `npm run build` |
| **doubles-sync.flow.mjs** | 41 | fetch（纯后端 curl，不起浏览器） | 双打「两主播同步」探测：两个独立会话（=两主播）各落一局双打互不干扰（各落一条 / double 榜累加 / 不串不丢）；结论——UI 层无多端合流机制 | PB 8090（`verify-all.sh` 已造 host/players） |
| **login.flow.mjs** | 22 | Playwright | 主播登录界面：三族 hero + 登录卡渲染（stage/输入框/按钮）+ 登录尝试（P5 在跑则验 success，不在仅验渲染不 FAIL） | `npm run build`（PB 8090 可选） |
| **single-match.flow.mjs** | 32 | Playwright | 单刷比赛全流程：home 比赛 tab 登录入口 → select 随机填充 3 场槽位 → battle 判定改 score | `npm run build`（PB 8090 可选） |
| **doubles-match.flow.mjs** | 32 | Playwright | 双打比赛引擎参数：6 号位官突双打 facPool=9 抽 CSV 真表；聚焦 select 引擎参数（落库链路另由 curl 验证） | `npm run build`（PB 8090 可选） |
| **ladder.flow.mjs** | 19 | Playwright | 积分天梯：3 tab（总/单刷/双打）渲染 + 切换 on + board 稳定态（ranked/empty） | `npm run build`（PB 8090 可选） |

---

## 4. 关键断言（`run.mjs` 为例）

```js
// === 阶段 1: bundle 完整性 ===
const bundleMarkers = [
  '__jjbDebug', 'winLoseList', '集结杯', 'jjbSession',
  'std8', 'std10', 'std12', 'rescue', 'one-a', 'hard1', 'hard2', 'feiqiu', 'suiji', 'std15', 'cm',
  '随机因子数极难', '混乱工作室', '礼尚往来', '极难因子组',
];
// 19 个 marker 全部必须在 dist/assets/*.js 里找到

// === 阶段 2: 9 模式循环，每模式断言 ===
// 断言 1: 池=槽恒等式 pool == Σ manualSlots
// 断言 2: 9 格契约 selectedFactorList.length === 9
// 断言 3: selectedCommanderList = [null, null, null]（开局前）
// 断言 4: status === 2（开局完毕）
// 断言 5: map=3, lock=3
// 断言 6: manualSlots 镜像对账（modelFactorCount/modeSuiji/modeFeiqiu/modeIsVeryHard/modeIsOnePick）

// === 段 3 ④ phase 3: 双打难度分隔离（关键不变量） ===
startSession('std10');
const diffBaseline = difficultyTotal();
startSession('doubles');  // 早分支启动，不动 JijieData
if (difficultyTotal() !== diffBaseline) fail(`doubles 隔离失败`);

// === Batch C: std15/cm 双打专项断言 ===
startSession('std15');   // variant/4A2B 指挥官池/factorPool=17/无锁定/自选区12/地图去重/全路径
startSession('cm');      // variant/3A3B(CM混抽)/factorPool=14/每场恒锁[风暴英雄,虚空裂隙]/自选区16
```

> 完整断言清单见 `web/e2e/run.mjs`，每段失败会 `process.exit(1)`，CI 直接红。

---

## 5. 后端全链路（`backend/verify-all.sh`）

10 段验证（每次新环境必跑）：

| 段 | 内容 |
|---|---|
| 0 | `/api/health` |
| 1-2 | 创建 superuser（CLI）+ auth 拿 token |
| 3-4 | 创建 3 accounts (admin/host/viewer) + auth 拿 token |
| 5 | 创建 2 players (P001/P002) via admin |
| 6 | **权限矩阵**：6a host POST match → 200；6b viewer POST match → 400 blocked；6c host POST scores → DENIED（scores admin-only）；6d admin POST scores → 200；6e admin PATCH logs → 403；6f anon GET matches → 200；6g anon vs admin GET logs |
| 7 | **hook test**：7a POST match (mode=match, result=[1,2,0], std12) → expect 200 + hook 派生 2 条 scores delta=2.4；7b GET scores filter match → totalItems=2；7c GET logs action=score.adjust + match.create 都应有；7d POST match mode=practice → 200；7e GET scores filter practice match → totalItems=0（不派生） |
| 8 | **rankings**：P1 = 2.4(6a-hook) + 5(6d-admin) + 2.4(7a-hook) = 9.8；P2 = 2.4(6a) + 2.4(7a) = 4.8 |
| 9 | **scoring**：GET /api/scoring 返系数表 |
| 10 | **sqlite 导出**：`data.db + wal + shm` → `sqlite3 .tables` 可见 7 张业务表（accounts/players/matches/scores/logs + event_rules/player_accounts）+ 核心 5 张行数 |

跑法：
```bash
cd backend
./verify-all.sh             # 一次性跑完 10 段（约 30s）
```

---

## 6. CI 集成建议

```yaml
# 最小化 CI 流程（github actions 范例）
steps:
  - uses: actions/checkout@v4
  - uses: actions/setup-node@v4
    with: { node-version: 20 }
  - uses: actions/setup-go@v5
    with: { go-version: '1.22' }

  - name: 安装
    run: |
      npm install
      (cd web && npm install)
      (cd admin && npm install)
      (cd backend && go mod tidy && go build -o pocketbase .)

  - name: 前端构建 + 纯逻辑 e2e
    run: |
      (cd web && npm run build)
      (cd web && node e2e/run.mjs)
      (cd web && node e2e/codec.mjs)
      (cd web && node e2e/bp-rules.mjs)
      (cd web && node e2e/random-enemy.mjs)

  - name: 后端启动 + verify-all
    run: |
      (cd backend && ./pocketbase serve --http 127.0.0.1:8090 &)
      sleep 5
      (cd backend && ./verify-all.sh)

  # 端到端（需 dev + PB 在跑，可拆独立 job）
  - name: 端到端联调
    run: |
      (cd web && npm run dev &)
      sleep 5
      (cd web && node e2e/match-flow.mjs)
      (cd web && node e2e/backend-integ.mjs)
      (cd web && node e2e/r6-doubles-downstream.mjs)
      (cd admin && npm run build && node e2e/admin-smoke.mjs)
```

---

## 7. 测试约定

1. **失败即停**：每个 e2e 失败 → `process.exit(1)`，CI 立即红。
2. **断言在描述里**：`FAIL: ${mode}: __jjbDebug.select 未透出` — 模式 + 字段 + 预期。
3. **不动产**：e2e 不写代码、不改 schema、不改系数表；只读 + 断言。
4. **dist 必新**：run.mjs 阶段 1 读 `web/dist/assets/*.js`，CI 上必先 `npm run build`。
5. **数据幂等**：verify-all.sh 每次都新建 superuser/accounts/players（PB upsert 语义），可重复跑。
6. **secret 不落**：e2e 用例里 hardcoded 的是 verify-all.sh 造的测试账号（`host@jjb.test` / `Viewer123456!` 等），**生产账号不进 e2e**。
7. **Vite SSR 模式**：纯逻辑 e2e 用 `createServer({ appType: 'custom', ssr: { noExternal: true, target: 'node' } })`，避免 React 渲染开销。

### 断言纪律（Cocos 时代事故教训，普适部分固化于此；原 jjb-verify skill 已归档）

8. **期望值从实测推导，禁 magic number**：几何/数值期望从运行态实测（DOM 包围盒、`__jjbDebug` 派生值）推导，不许按坏实现反推常量写死（事故：-360 就是按坏实现反推的）。
9. **禁断自报常量**：断言的字段必须是实测派生值，不许断「代码里写死的 true」——断言自报常量等于没测。
10. **硬断言，不许只看 HTTP 200 / 无 error**：每条 flow 必有 `__jjbDebug` 或 DOM count 硬断言；截图存 `/tmp/jjb-flow-<name>.png` 且关键态目检；落库类必 curl 后端基线对比 Δ（matches/scores/rankings），不只信前端 console。
11. **可见性通检**：字符串非空 ⇒ 对应元素可见且宽 > 0；OBS 屏类多视口（1280/1600/800 宽）覆盖。
12. **副作用逻辑做同帧重入防御**：真实点击可能 touch+mouse 双触发（同帧两次回调），测试单发 emit 复现不了——写副作用类交互时按幽灵控制条修复的范式防重入。

---

## 8. 故障排查速查

| 现象 | 排查 |
|---|---|
| `dist/index.html missing` | 跑 `npm run build` |
| `__jjbDebug.select 未透出` | JijieData 初始化异常；跑 `node e2e/run.mjs` 看具体 mode 的 console（SSR 直调 startSession 复现） |
| `verify-all.sh` `503 connection refused` | PB 没起 / 端口不对 |
| `match-flow.mjs` 卡 login | host 账号未造；先跑 verify-all.sh |
| `r6-doubles-downstream.mjs` 截图空 | Playwright 浏览器未装（首次需 `npx playwright install chromium`） |
| `snap:visual` 报 missing baseline | 首次建立或有意接受视觉变化：`npm run snap:visual -- --update`，再跑普通 `npm run snap:visual` 确认 0 diff |
| `snap:visual` 报 pixel diff | 看 `web/e2e/snapshots/diff/*.png`；若是预期 UI 变化，更新 baseline；若是随机/图片未加载，先修脚本等待条件，不要放宽阈值掩盖 |
| `admin-smoke.mjs` logs 403 | viewer 误用 admin token；检查 auth 函数返回值 |
| 双打 `difficultyTotal` 漂移 | jjbDoules 污染了 JijieData — 走 P5 真代码审查回归（看记忆 `R5 select bugfix`） |

---

## 9. TODO（待补 / 留后续 round）

- [x] **vitest 已引入**：`web/src/logic/__tests__/` 12 文件 126 用例（backend/codec/commanderWeight/eventBan/goldRuntime/jjbSession/matchRecord/mutatorPool/config-modes/jjbDoubles/scoring-contract/visual-diff），`npm run test:unit` 跑；`test:drift`/`test:back` 另覆盖配置漂移守护与后端 go test。
- [ ] **admin 前后端契约一致性验证**：devbox 三层版本对齐（web 来自 jjb-live-dock、admin 来自本地 build、backend 独立二进制）— 留 P2 round。
- [ ] **覆盖率上报**：跑完 e2e 后输出 codec/jjbSession/jjbDoubles 覆盖率（c8 或 vitest --coverage）。
- [ ] **CI 缓存**：`node_modules` / `~/.cache/go-build` / `~/.cache/vite` 三段缓存可大幅加速。
- [ ] **performance baseline**：build 退出时间 < 30s；e2e 单脚本 < 60s（已大致满足，待实测）。

# 集结杯 · 测试体系（Testing）

> 范围：项目三层测试体系——①代码层（前端 build / 后端 Go）②AI-E2E（Playwright + 纯 Node fetch）③双打同步（两 profile 对战）。
> 真相源：`web/e2e/*.mjs`（7 个前端 e2e）+ `admin/e2e/admin-smoke.mjs`（后台 e2e）+ `backend/verify-all.sh`（后端全链路）。

---

## 0. 三层测试体系总览

```
┌─────────────────────────────────────────────────────────────────────┐
│  ③ 双打同步（端到端 + 两 profile 对战）                                │
│     · web/e2e/r6-doubles-downstream.mjs                              │
│     · 验证：双打局 → 落库 → 派生 scores → 选手关联                     │
│     · 依赖：dev 7788 + PB 8090 + 数据已造                             │
├─────────────────────────────────────────────────────────────────────┤
│  ② AI-E2E（Playwright + 纯 Node fetch）                                │
│     · 浏览器：match-flow / r6-doubles / ui-smoke                     │
│     · 纯逻辑（Vite SSR）：run / codec / bp-rules / random-enemy       │
│     · 后端：backend-integ                                            │
├─────────────────────────────────────────────────────────────────────┤
│  ① 代码层（前端 build / 后端 Go）                                     │
│     · web: npm run build（Vite + TS 0 error）                         │
│     · backend: go build / go test                                     │
│     · 启动：./pocketbase serve + migrate up                           │
└─────────────────────────────────────────────────────────────────────┘
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
node e2e/run.mjs                         # 9 模式 + 双打 + BP + 二选一 全断言（588 行）
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

`admin/package.json`：
- `npm run dev` / `npm run build` / `npm run preview --port 7790`
- `npm run tsc`：`tsc --noEmit`（类型检查）
- `npm run e2e:smoke`：`npm run build --silent && node e2e/admin-smoke.mjs`

---

## 3. 8 个 e2e 脚本覆盖矩阵

| 脚本 | 行数 | 类型 | 覆盖什么 | 前置 |
|---|---|---|---|---|
| **run.mjs** | 588 | Vite SSR 纯逻辑 | ① bundle 完整性 + 16 接缝标记 ② 9 模式全开局（池=槽恒等式 / 9 格契约 / status=2 / map=3 / lock=3 / manualSlots 镜像）③ 双打启动接缝 + 手选 + verdict + 难度分隔离 ④ BP ban（practice 无上限 / match 上限 1 / 「超出比赛规则」 / 落槽防御 / 随机护栏 / 新局重置） ⑤ 二选一互斥（ban⊕自选：`null→ban→conflict(warn)→self`） | `npm run build`（阶段 1） |
| **codec.mjs** | 174 | Vite SSR 纯逻辑 | ① 9 模式 + 双打 capturePayload→encode→decode 深比对 ② 三道闸（version / pool / invalid）③ 越界 idx + 随机敌方 ON 往返 + 码长报告 | `npm run build` |
| **bp-rules.mjs** | 121 | Vite SSR 纯逻辑 | 聚焦 done-when 5（双打 2A1B 不拦 + cmdPool=6）+ 6（feiqiu-doubles=locked）+ 1-4 综合 smoke | `npm run build` |
| **random-enemy.mjs** | 103 | Vite SSR 纯逻辑 | ① 开关 ON→单打/双打每场 roll 合法敌方 ② OFF→全 undefined ③ 数据 19 条 / 种族 8·6·5 / id 唯一 | `npm run build` |
| **ui-smoke.mjs** | 316 | Playwright 浏览器 | React DOM 烟雾测试（产物可用性 + 关键节点挂载） | `npm run build` |
| **match-flow.mjs** | 56 | Playwright + fetch | dev 登录（host）→ home match 选手 P001 → std8 开局 → 判定 3 场 → result → 落库 → 选手关联 → hook 派生 scores | dev 7788 + PB 8090 + verify-all.sh 已造 P001/P002 |
| **backend-integ.mjs** | 56 | fetch (node v23+) | host auth → postMatch → hook 派生 scores → 天梯增量（与 match-flow 不同：纯 fetch，不渲染 UI） | dev 7788 + PB 8090 |
| **r6-doubles-downstream.mjs** | 268 | Playwright + spawn | 双打下游 R6：3 屏 PNG 截图 + 落库断言（截图存 `/tmp/jjb-r6-doubles-downstream/`） | dev 7788 + PB 8090 |
| **admin-smoke.mjs** | ~150 | fetch (node v23+) | 三角色登录 + 对局/选手/天梯/系数 fetch + role 守卫（viewer 不能读 logs，host 不能读 accounts）+ admin 调分 | PB 8090 + verify-all.sh 已造 |

---

## 4. 关键断言（`run.mjs` 为例）

```js
// === 阶段 1: bundle 完整性 ===
const bundleMarkers = [
  '__jjbDebug', 'winLoseList', '集结杯', 'jjbSession',
  'std8', 'std10', 'std12', 'rescue', 'one-a', 'hard1', 'hard2', 'feiqiu', 'suiji',
  '随机因子数极难', '混乱工作室', '礼尚往来', '极难因子组',
];
// 16 个 marker 全部必须在 dist/assets/*.js 里找到

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
| 10 | **sqlite 导出**：`data.db + wal + shm` → `sqlite3 .tables` 可见 5 张表 + 行数 |

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

---

## 8. 故障排查速查

| 现象 | 排查 |
|---|---|
| `dist/index.html missing` | 跑 `npm run build` |
| `__jjbDebug.select 未透出` | JijieData 初始化异常；看 console + `?screen=phase0` 跑 startSession |
| `verify-all.sh` `503 connection refused` | PB 没起 / 端口不对 |
| `match-flow.mjs` 卡 login | host 账号未造；先跑 verify-all.sh |
| `r6-doubles-downstream.mjs` 截图空 | Playwright 浏览器未装（首次需 `npx playwright install chromium`） |
| `admin-smoke.mjs` logs 403 | viewer 误用 admin token；检查 auth 函数返回值 |
| 双打 `difficultyTotal` 漂移 | jjbDoules 污染了 JijieData — 走 P5 真代码审查回归（看记忆 `R5 select bugfix`） |

---

## 9. TODO（待补 / 留后续 round）

- [ ] **vitest 引入**：当前无单元测试（直接用 Vite SSR e2e 覆盖逻辑）。后续给 codec / scoring 抽 vitest 单测更快。
- [ ] **admin 前后端契约一致性验证**：devbox 三层版本对齐（web 来自 jjb-live-dock、admin 来自本地 build、backend 独立二进制）— 留 P2 round。
- [ ] **覆盖率上报**：跑完 e2e 后输出 codec/jjbSession/jjbDoubles 覆盖率（c8 或 vitest --coverage）。
- [ ] **CI 缓存**：`node_modules` / `~/.cache/go-build` / `~/.cache/vite` 三段缓存可大幅加速。
- [ ] **performance baseline**：build 退出时间 < 30s；e2e 单脚本 < 60s（已大致满足，待实测）。
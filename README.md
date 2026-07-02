# 集结杯（JJB · Jijiebei）

> **星际争霸 2 合作任务突变因子比赛平台** —— B 站主播「土豆」主办 × 社区 MOD「CM」联名。**不是**单纯的「抽签前端」。

项目面向「工具 → 平台」演进：前端 React 11 屏（home / select / battle / result / obs / ladder / login / register / eventrules / bpconfig / code） + Arco 业务后台 + PocketBase 后端（7 集合 + Go hook 算分 + 天梯聚合 + 需求1 选手登录 + 需求2 赛事 ban） + devbox 三层同源部署（web / admin / api 共享 nginx:8080）。

| 入口 | 文档 |
|---|---|
| 装/跑/测/部署导航 | 当前 README §3 快速开始 |
| 11 屏 + 7 集合 + 数据流 | [docs/architecture.md](docs/architecture.md) |
| 三层测试（vitest / AI-E2E / 双打同步） | [docs/testing.md](docs/testing.md) |
| devbox 部署手册（nginx / Litestream / 回滚） | [docs/deployment.md](docs/deployment.md) |
| 主播账号 / 选手 / 赛季 / 系数 / 天梯 / FAQ | [docs/operations.md](docs/operations.md) |

---

## 1. 项目定位（★先看这）

**问题域**：SC2 合作任务（co-op）比赛，需要在「官方指挥官池 × 官方突变因子池 × 官方地图」三维空间里抽签出题，按赛季聚积分排天梯。

**核心抽象**：
- **13 种比赛形态** —— 单打 9 模式：`std8` / `std10` / `std12`（标准因子数）/ `rescue`（拯救）/ `one-a`（指挥官一选一）/ `hard1` / `hard2`（极难）/ `feiqiu`（非酋）/ `suiji`（完全随机）；双打 4 变体（jjbDoubles per-variant）：`doubles`（官突）/ `feiqiu-doubles`（非酋之轮）/ `std15`（15 因子双打随机）/ `cm`（CM 双打·恒锁风暴英雄+虚空裂隙）。首页入口 8 格从 `web/src/config/modes.ts` 派生。完整赛制表见 `mode-rules-truth-table.md`。
- **9 格契约**：每场比赛 3 场 × 3 因子格（包含 1 个锁定因子 + N 个手选因子）= 9 格；`selectedFactorList` 长度恒为 9。
- **池=槽恒等式**：随机池的可用因子数 == 9 格中待手选的槽位数（避免「抽多了塞不下、抽少了卡开局」）。
- **码方案**：整局（mode + 地图 + 锁定因子 + 指挥官 + 因子）→ 自包含短码（codec.ts，schema v1 冻结），可贴码还原同盘。

**用户角色**：
- **观众 / 直播观众**：扫码进入 select 屏参与抽签；走 home → obs / ladder / result 旁路。
- **选手**：用 player_code 锚定身份（昵称可改、code 不可改）；host 录入对局 → hook 自动算分 → 天梯聚合。
- **主播**：登录后台，发起比赛模式，录入玩家与对局结果。
- **管理员**：维护选手池、调整系数、查审计日志。

---

## 2. 目录地图

```
jijiebei/
├── README.md                    ← 本文件（入口 + 快速开始）
├── projectplan.md               ← 决策史 / 迭代记录（只读引用）
├── docs/                        ← 4 份开发者文档
│   ├── architecture.md
│   ├── testing.md
│   ├── deployment.md
│   └── operations.md
├── web/                         ← React + Vite 前端（11 屏）
│   ├── src/
│   │   ├── screens/             ← 11 个屏组件（home/select/battle/result/obs/ladder/login/register/eventrules/bpconfig/code）
│   │   ├── components/          ← 共享 UI 组件（BrandLockup/MatchRow/FactorFrame/...）
│   │   ├── logic/               ← 核心逻辑（jjbSession 状态机 / jjbDoubles 双打 / codec 编解码 / backend API 客户端）
│   │   ├── lib/                 ← 工具（capture/snapDOM 截图 / dragdrop / designAssets）
│   │   └── styles/              ← 三主题（metal / sc2 / minimal）× 二模式（dark / light）CSS
│   ├── e2e/                     ← 7 个 e2e 脚本（run / codec / match-flow / backend-integ / random-enemy / bp-rules / r6-doubles / ui-smoke）
│   ├── package.json
│   └── vite.config.ts           ← dev/preview 都把 /api 反代到 127.0.0.1:8090
├── admin/                       ← Arco 业务后台（5 模块 · build base=/admin/）
│   ├── src/{pages,api,auth,guard,layout}/
│   └── e2e/admin-smoke.mjs
├── backend/                     ← PocketBase + Go hook 后端
│   ├── main.go                  ← 入口（migrate + loadScoring + registerHooks + registerRoutes）
│   ├── hooks.go                 ← match→scores 派生 + 审计
│   ├── routes.go                ← /api/rankings /api/scoring 自定义路由
│   ├── scoring.go               ← 系数表加载 + delta 计算
│   ├── pb_migrations/           ← 5 个 Go embed 迁移（init / lock users / scores wins·games / event_rules / player_accounts）
│   ├── pb_data/                 ← SQLite 数据（含 data.db + wal + shm）
│   ├── config/scoring.json      ← 系数表（修改重启即生效，不重编译 Go）
│   ├── deploy/                  ← nginx conf / systemd / Litestream / runbook / Dockerfile
│   └── verify-all.sh            ← P5 后端全链路验证脚本
├── knowledge-base/              ← 飞书 wiki 维护素材（已同步飞书）
├── design/v4-r2/                ← 当前 live 设计轮（6 主题 token，Claude Design 出稿）
├── config/                      ← harness-pro 模型/策略/部署配置
├── scripts/                     ← harness-enforcement 等
└── package.json                 ← 根 package.json（harness-pro CLI 入口）
```

---

## 3. 快速开始

### 3.1 前置
- **Node.js 18+**（Vite 5 需要；实测 v18 LTS / v20 LTS / v22 均可）
- **Go 1.22+**（后端编译；arm64 Mac 可直接编译本机二进制）
- **Python 3**（verify-all.sh 用 python3 解析 JSON；非必需，验证脚本辅助）
- **git**（含 submodule 拉 harness-pro-core 时）

### 3.2 装依赖
```bash
# 根：harness-pro CLI（用 file: 链本地 harness_pro_core）
npm install

# 前端
cd web && npm install && cd ..

# 后台
cd admin && npm install && cd ..

# 后端：首次拉 Go 依赖
cd backend && go mod tidy && cd ..
```

### 3.3 跑（本地开发）
```bash
# 终端 1：后端（先用 verify-all.sh 造数据）
cd backend
./pocketbase serve --http 127.0.0.1:8090     # Admin UI: http://127.0.0.1:8090/_/
# 另一终端：造测试账号 + 选手（前提：起 superuser）
./verify-all.sh                                # 跑完会有 admin/host/viewer 三个账号

# 终端 2：前端
cd web
npm run dev                                     # http://localhost:7788/

# 终端 3（可选）：后台
cd admin
npm run dev                                     # http://localhost:7790/
```

vite dev/preview 都会把 `/api` 反代到 `127.0.0.1:8090`（见 `web/vite.config.ts`），**前端 fetch `/api/...` = 直连 PocketBase**，免 CORS。

### 3.4 测
```bash
cd web
npm run build                                    # TS 编译 + 产出 dist
node e2e/run.mjs                                 # 9 模式 + 双打全路径 SSR 断言
node e2e/codec.mjs                               # 码方案往返等价 + 三道闸
node e2e/bp-rules.mjs                            # BP 规则专项（practice/match 软违规）
node e2e/random-enemy.mjs                        # 随机敌方端到端
node e2e/ui-smoke.mjs                            # 浏览器 UI 冒烟（需 build）
# 端到端（需 dev 在跑 + 后端在跑 + 数据已造）：
node e2e/match-flow.mjs                          # 比赛模式真实 UI 落库
node e2e/backend-integ.mjs                       # 端到端 API 联调
node e2e/r6-doubles-downstream.mjs               # 双打下游 R6（截图+断言）
```

后端：
```bash
cd backend
./verify-all.sh                                  # 权限矩阵 + hook + 天梯 + sqlite 导出（全链路）
```

### 3.5 部署
详见 [docs/deployment.md](docs/deployment.md)。摘要：
- 三层同源 devbox（nginx:8080）：web / admin / api 共享同一端口。
- 交叉编译：本地 `GOOS=linux GOARCH=amd64 go build` → scp 推 devbox。
- 容器版本：`backend/deploy/nginx-docker-triple.conf`（容器内 listen 80、走 docker0 网关 172.17.0.1:8090 反代 backend）。
- 容灾：Litestream sidecar 实时增量复制 SQLite WAL → 对象存储。

---

## 4. 现状（截至 2026-06-24）

- ✅ 前端 9 屏 + 2 子页（bpconfig / code）已交付，dev 跑通；build 0 error，9 模式 + 双打全路径 e2e 绿。需求1（选手/主播双登录 + 注册 + 登录门）+ 需求2（赛事临时 ban）已上线。
- ✅ 后端（7 集合 + Go hook + /api/rankings /api/scoring /api/event-rules）全链路验证（`backend/verify-all.sh` 10 段全绿）。
- ✅ devbox 部署：web（jjb-live-dock） + admin（jjb-admin-dock） + backend（systemd `jjb-backend`）+ nginx（docker 容器 `jijiebei-nginx`）三层同源 :8080 实测联通。
- ✅ 三层测试：①代码层（前端 build + 后端 Go test）②AI-E2E（8 个 e2e 脚本）③双打同步（两 profile 对战）。
- ⚠️ 系数表（`config/scoring.json`）天梯上线前须 yb/土豆拍板定稿（caveat 3）。
- ⚠️ cloudflared quick tunnel 治标不治本（重启换 URL），长期正解 CF Pages（见 `web/public/_redirects` 已预置）。

---

## 5. 红线 / 约定

- **纯文档改动不轻易 commit**：hub 走 harness-pro round gate。
- **三方 key 字面量**：Dubhe / Object store / CF Tunnel 凭据 → 走 env 临时注入，不落盘不进 git 也不进文档示例。
- **0 改 `assets/Script/jijie2/`**：XP 维护，jjbDesign 边界只读 `JijieData` public + 调 XP handler。
- **「失活孤儿」清理**：当前 round 改动导致的孤儿 import / 变量 / 函数 → 清掉；原本就存在的 dead code → 不动（标 TODO 即可）。

---

## 6. 相关 skill（harness 视角）

| skill | 何时用 |
|---|---|
| `jjb-knowledge-base` | 维护飞书 wiki（沙盒先行 + design token 同步） |
| `jjb-run-broadcast` | 本地起服务 / 主播采集 / 公网测试 |
| `jjb-deploy` | 部署到 devbox / 排查 8080 不可达 / 换机器重建 |
| `jjb-verify` | 改 jjbDesign 写断言 / 做截图验证 |
| `jjb-dev-loop` | 推进新设计轮 / 派发工程 round / 写派发契约 |
| `jjb-public-deploy-policy` | 公网暴露方案选型（CF Pages 优先） |
| `jjb-platform-roadmap` | 6 phase 并行路线图 + 关键决策 |
| `harness-pro` + `agent-dispatch` | 派发 spoke / 收口 gate / 多 phase 推进 |

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

## 1.5 三层演化史 · 我该改哪里（★新维护者必读）

这个仓库是「在一个 Cocos 老项目的躯壳上重写出来的新平台」，根目录因此同时躺着三代代码。**先分清哪层是活的**：

| 层 | 位置 | 地位 | 能不能动 |
|---|---|---|---|
| ① XP 原工程（化石） | `assets/`（Script/jijie2 抽签引擎原件 + 场景 + 资源）+ 根目录 Cocos 脚手架（`creator.d.ts` / `project.json` / `template*` / `settings/` / `jsconfig.json` / 根 `tsconfig.json`） | Cocos Creator 2.4 原项目，历史真相源。`assets/resources/jjdata/*.txt` 是赛制配置的**原件**（web 运行期读的是 `web/src/data/jjdata/` 下的同步副本） | **只读**。改赛制配置需两处同步（原件+副本），改引擎行为去 legacy 副本 |
| ② legacy 复刻引擎 | `web/src/logic/legacy/`（JJConfigData / JijieData / JJBData） | 从 ①verbatim 逐字复刻的运行期真身，新平台的抽签内核。详见 [web/src/logic/legacy/README.md](web/src/logic/legacy/README.md)（副本↔原件对照表 + 分叉规则） | **只调用不改内部**；确需修正走「只改副本、绝不回改原件」规则 |
| ③ 新平台（主战场） | `web/`（React 前端）+ `backend/`（Go PocketBase）+ `admin/`（运营后台） | 日常开发全部在这里 | 正常开发，守 §5 红线 |

根目录还有一批**不入 git 的本机产物**：`.harness-pro-*`（多 agent round 审计留档）、`library/ build/ temp/ local/`（Cocos 构建缓存，可随时删可再生）、`config/ scripts/ package.json`（本机 harness-pro 工具链，fresh clone 后不存在——README 提到它们时均指本机环境）。

---

## 2. 目录地图

```
jijiebei/
├── README.md                    ← 本文件（入口 + 快速开始）
├── AGENTS.md                    ← ★集中红线清单（人与 AI 共读，改代码前先看）
├── projectplan.md               ← 决策史 / 迭代记录（append-only 只读引用）
├── mode-rules-truth-table.md    ← 9 单打 + 4 双打赛制真相表（单一真相源）
├── docs/                        ← 开发者文档（索引见 docs/README.md；archive/ 放历史快照，只增不改）
├── web/                         ← React + Vite 前端（主战场）
│   ├── src/
│   │   ├── screens/             ← 11 个屏组件（home/select/battle/result/obs/ladder/login/register/eventrules/bpconfig/code）
│   │   ├── components/          ← 共享 UI 组件（BrandLockup/MatchRow/FactorFrame/...）
│   │   ├── logic/               ← 核心逻辑（jjbSession 纯 barrel / jjbDoubles 双打引擎 / jjbView 分流门面 / codec 编解码 / backend API 客户端）
│   │   ├── logic/session/       ← 单打状态机六文件（sessionConfig/Engine/Runtime/Selection/Scoring/Debug，R5 拆分，经 jjbSession barrel 消费）
│   │   ├── logic/legacy/        ← ★XP verbatim 复刻引擎（只调用不改，见 §1.5）
│   │   ├── data/jjdata/         ← 赛制配置运行期副本（原件在 assets/resources/jjdata/，两处须一致）
│   │   ├── lib/                 ← 工具（capture/snapDOM 截图 / dragdrop / designAssets）
│   │   └── styles/              ← 三主题 × 明暗 CSS（全部是对 design/v4-r2 只读基座的双类 specificity 覆盖）
│   ├── e2e/                     ← 17 个 e2e 脚本 + flows/ 7 条 AI-E2E（清单见 docs/testing.md §3）
│   └── vite.config.ts           ← dev/preview 都把 /api 反代到 127.0.0.1:8090
├── admin/                       ← Arco 业务后台（5 模块 · build base=/admin/）
├── backend/                     ← PocketBase + Go hook 后端
│   ├── main.go / hooks.go / routes.go / scoring.go
│   ├── pb_migrations/           ← 7 个 Go embed 迁移（init / lock users / scores wins·games / event_rules / player_accounts / matches practice rule / matches timestamps）
│   ├── config/scoring.json      ← 系数表（修改重启即生效，不重编译 Go）
│   ├── deploy/                  ← nginx conf / systemd / Litestream / Dockerfile
│   ├── scripts/check-migrations.mjs ← 部署前迁移核对（只更新 web 前必跑）
│   └── verify-all.sh            ← 后端全链路验证脚本（隔离造数据）
├── assets/ + Cocos 脚手架       ← ★XP 化石层（只读，见 §1.5 与 assets/README.md）
└── design/v4-r2/                ← 当前 live 设计基座（只读红线，6 主题 token）
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
# 前端
cd web && npm install && cd ..

# 后台
cd admin && npm install && cd ..

# 后端：首次拉 Go 依赖
cd backend && go mod tidy && cd ..
```
> 根目录的 `package.json` / `config/` / `scripts/` 是本机 harness-pro 工具链、不入 git——fresh clone 没有它们，不需要「根 npm install」。

### 3.3 跑（本地开发）
```bash
# 终端 1：后端（pocketbase 二进制是构建产物、不入 git，首次先 build）
cd backend
go build -o pocketbase .
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
四层测试体系（vitest 单测 / 纯逻辑 e2e / 浏览器与联调 / AI-E2E flows）；**e2e 脚本与 flows 的完整清单、计数与前置依赖见 [docs/testing.md](docs/testing.md) §3（唯一真相源，此处不复读）**。最常用的四条：
```bash
cd web
npm run build                                    # TS 编译 + 产出 dist（多数 e2e 的前置）
npm run test:unit                                # vitest 单测（最快）
node e2e/run.mjs                                 # 9 模式 + 双打全路径 SSR 断言（核心恒等式门）
node e2e/codec.mjs                               # 码方案往返等价 + 三道闸
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

## 5. 红线 / 约定

**完整红线清单集中在 [AGENTS.md](AGENTS.md)（改任何代码前先读）**。速览：XP 化石层只读（§1.5）、legacy 只调不改、`design/v4-r2/` 只读（含 theme.css button reset 坑）、`backend/pb_data` 现网不碰、池=槽恒等式 + 双打 4 variant 契约 + codec schema v1 冻结不可破、devbox 部署方式不变、三方 key 不落盘、失活孤儿清理（本次改动的孤儿清掉，原有 dead code 不顺手删）。

---

## 6. 相关 skill（harness 视角）

仓内 skill 在 `.claude/skills/`（R2 起入库进 git）：

| skill | 何时用 |
|---|---|
| `jjb-knowledge-base` | 维护飞书 wiki（沙盒先行 + design token 同步） |
| `jjb-run-broadcast` | 本地起服务 / 主播采集 / 公网测试 |
| `jjb-deploy` | 部署到 devbox / 排查 8080 不可达 / 换机器重建 |
| `jjb-e2e-flows` | 跑/加 AI-E2E flow（清单与纪律见 docs/testing.md §3/§7） |
| `jjb-dev-loop` | 推进新设计轮 / 派发工程 round / 写派发契约 |
| `harness-pro-repo-adapter` | 本仓 harness round 的 runtime/reviewer 配置入口 |

（`harness-pro` + `agent-dispatch` 为全局 skill，派发 spoke / 收口 gate 时用；已归档的 Cocos 验证手册见 `docs/archive/skill-jjb-verify-cocos.md`。）

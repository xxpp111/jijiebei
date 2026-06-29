关键事实已核实：4 路调研的核心断言全部对齐 live truth（web 零生产依赖只有 react/react-dom、8 处 @logic/@jjb 引用精确、jjdata 5 txt + docs 3 csv + web/src/data 2 ts + 死数据目录、图片实测 212 张 10M）。一处微调：图片是 212 张而非约 190。现在动笔。

# 集结杯比赛平台技术调研报告 + 架构设计 + 分阶段路线图

> 综合 4 路调研（后端选型 / 架构剥离现状 / config·CSV 梳理 / 前端技术点）。所有结构性断言已对 live truth 核实：`web/` 当前生产依赖仅 `react`+`react-dom`，旧层引用为 8 处经 `@logic`/`@jjb`、实质 3 个文件，jjdata 5 txt + docs 3 csv + web/src/data 2 ts，真实游戏图 **212 张 / 10MB**，`assets/resources/data/*` 为死数据。

---

## 0. 一页结论（先给拍板项）

| 决策点 | 结论 | 一句话理由 |
|---|---|---|
| **后端** | **PocketBase（SQLite）+ Litestream 备份** | 单个 15MB Go 二进制、一进程、SQLite 单文件即可 `cp` 导出、自带认证+Admin UI，与现状"一台开发机 + docker + nginx"最契合 |
| **后端备选** | Directus（运营要重度改数据时）/ 纯 Fastify（强定制时） | 都更重或要造轮子，当前阶段是过度工程 |
| **码方案** | 索引化 JSON → base64url 进 URL `#hash`，带版本号，**零依赖** | 真实 payload 索引化后约 100 bytes，离 2000 上限 10% 都不到，lz-string/后端短链此刻都不需要 |
| **截图** | **snapDOM**（`<foreignObject>` 路线） | 项目大量 `clip-path` 斜切 + SC2 中文字体，正好是 html2canvas 两大死穴 |
| **数据库引擎** | SQLite（非 Postgres） | 单机、读多写少、写入串行友好；多 writer 高并发才需要 PG，目前不会发生 |
| **剥离工作量** | 半天～1 天，低风险 | 搬 3 个逻辑文件 + 5 CSV + 1 图片目录，零算法改写 |
| **并行策略** | 前端 P1-P4 先行（Claude Design），后端 P5 调研后接入，二者并行 | 码方案/截图/BP/分流全是纯前端，不阻塞后端 |

---

## 1. 后端选型结论

### 1.1 推荐：PocketBase（SQLite）+ Litestream

**承载需求**：每盘对局数据（比赛+练习）、选手表、积分/天梯、操作日志、主播账号权限认证。这是一个**读多写少、写入来源单一（少量主播客户端/采集进程串行写）、规模几十到几百选手、单机部署**的工作负载——SQLite 的甜区，而非其痛点（SQLite 瓶颈是多 writer 抢库级写锁，不是写吞吐；WAL 模式下 NVMe 单机可达 1–5 万写/秒，读永不阻塞写）。

逐条命中用户硬约束：

| 用户约束 | PocketBase 如何满足 |
|---|---|
| **③数据自掌控（在 DevOps、可导出）** | 数据 = 一个 SQLite 文件落在开发机持久化卷，`cp` 即完整备份/导出，任意 SQLite 工具可直接打开；Admin UI 浏览器直接看对局/选手/天梯 |
| **①简洁轻便** | 单个 ~15MB 二进制、一进程 50–100MB RAM、**零 Docker 依赖、无第二个 DB 进程、无 8/20 个容器** |
| **主播权限认证** | 邮箱密码 + OAuth2 + 按集合/记录的访问规则 + Admin 后台，**零代码**搞定，不用自己拼 JWT+RBAC+后台 |
| **①可扩展** | CRUD/认证靠配置；积分算法、天梯排名、日志钩子等自定义逻辑可把 PocketBase 当 Go 框架嵌入，写 hooks/事件/自定义路由 |
| **④前后端并行** | REST + JS SDK，前端 React 直连；后端可 /goal spoke 自跑 loop（schema 定义 + hooks 是清晰的可验证目标） |

### 1.2 与现有 docker + nginx 部署如何共存（关键）

现状是 `jjb-deploy` 链路：开发机 devbox-tianlang（10.37.220.128）跑 docker nginx 静态托管 `web/dist`，8080 暴露。接后端**不动现有静态托管**，只加一条反代：

```
                       开发机 devbox (docker)
   浏览器 ──► nginx :8080 ┬── location /            → web/dist 静态文件（现状不变）
                          └── location /api/        → proxy_pass http://127.0.0.1:8090  (PocketBase)
                                                          │
                          PocketBase 进程 :8090 ──► pb_data/data.db (SQLite 单文件)
                                                          │
                          Litestream sidecar ──► 实时增量复制 → 国内 OSS / S3 兼容桶
```

- PocketBase 可作为**第二个 docker 容器**或裸进程跑在开发机，数据目录挂持久化卷（与现有 nginx 容器井水不犯河水）。
- nginx 加一段 `location /api { proxy_pass http://127.0.0.1:8090; }`，前端 `fetch('/api/...')` 同源，免 CORS。
- **Litestream** 单二进制 sidecar 把 SQLite 实时复制到对象存储，解决"数据自掌控 + 灾难恢复最后一块"——服务器炸了从桶恢复，最多丢几秒。这把"生产环境 SQLite 不可靠"的老问题彻底关掉。
- 部署纪律沿用 `jjb-deploy`（开发机外网受限、拉镜像难是最大障碍）——PocketBase 二进制可本地下好随产物一起推，不依赖在开发机现拉镜像。

### 1.3 备选与淘汰理由（一句话）

- **备选 1 — Directus（接 SQLite）**：当出现"非技术运营要在后台**大量手改数据**、要**字段级 RBAC**、要 REST+GraphQL 双 API"时升级。代价：更重（Node + 独立库 + 300–500MB）+ 营收/融资 <$5M 才免费的 license 门槛（大概率满足，留意）。
- **备选 2 — 纯 Fastify 自建**：技术最干净、上限最高，但认证/权限/Admin UI 全要造轮子，违背"最少必要代码"。仅当 PocketBase/Directus 都满足不了的强定制才上。
- **淘汰 — Supabase 自托管**：8 容器（Postgres+GoTrue+PostgREST+Realtime+Storage+Kong+Studio），无 >$200/月云账单或合规硬需求不值得自托管，直接与"轻便"冲突。
- **淘汰 — Appwrite 自托管**：20+ 容器、≥4GB RAM、MariaDB/Redis/InfluxDB 三件套，**数据导出是明显弱项**（无内建导出工具），对一台开发机太重。

> **SQLite vs Postgres 最终判据**：选 SQLite = 单进程/单机 + 写入串行友好 + 接受灾难时丢几秒（Litestream 兜底）；才需 Postgres = 多个独立 writer 同时改不同行 / 横向扩展 / 复杂分析查询。**你当前一条都不满足。** 且 PocketBase 数据是标准 SQL，未来迁 PG 路径不堵。

---

## 2. 整体平台架构（文字图）

### 2.1 分层总览

```
┌──────────────────────────────────────────────────────────────────────────┐
│  浏览器 (选手 / 主播 / 观众)                                                  │
│  ┌────────────────────────── React + Vite SPA (web/) ──────────────────┐    │
│  │  入口分流 ── 练习模式 ──┐                                              │   │
│  │             比赛模式 ──┤                                              │   │
│  │                        ├─► 选择引擎 (jjbSession + JJConfigData 抽签)   │   │
│  │                        │   BP 规则层 (bpConfig, 已定稿)               │   │
│  │                        ├─► 截图导出 (snapDOM → PNG, 复制/下载)        │   │
│  │                        ├─► 码方案 (索引化 JSON → base64url → #hash)   │   │
│  │                        └─► ObsScreen 主播直播横条 (选手ID展示)        │   │
│  │  配置层 web/src/config/* (单一真相源, 强类型, 与后端 JSON 同形)        │   │
│  └──────┬──────────────────────────────────────────────┬──────────────┘    │
│         │ 同源 fetch /api/*（仅比赛模式 & 登录后写）        │ 无后端也能跑(练习/码)│
└─────────┼──────────────────────────────────────────────┼───────────────────┘
          ▼                                                ▼
┌──────────── 开发机 devbox (docker + nginx :8080) ──────────────────────────┐
│  nginx ── / → web/dist (静态, 现状)                                          │
│        └─ /api → PocketBase :8090                                            │
│                    ├─ Auth (主播账号: 邮箱密码/OAuth2 + 记录级权限规则)        │
│                    ├─ Collections REST (matches/players/scores/logs)        │
│                    └─ Go hooks (积分计算 / 天梯刷新 / 写入校验)               │
│  PocketBase ──► pb_data/data.db (SQLite 单文件, WAL)                         │
│  Litestream ──► 实时增量复制 → 对象存储 (容灾 + 可导出)                       │
└────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 数据流（三条主线）

1. **练习模式（无后端依赖，纯前端闭环）**：选手进入 → 抽签引擎本地生成一局 → snapDOM 出图 / 生成码 → 分享。**全程不碰后端**，离线可用，承载"大量玩家自助练习、提效降本、减少人际沟通"的主战场。
2. **比赛模式（写后端）**：主播登录（PocketBase Auth）→ 主持一局 → 选择状态写 `matches` 集合 → Go hook 触发积分计算写 `scores`、刷新天梯 → ObsScreen 拉 `players` 展示选手 ID → 关键操作落 `logs`。
3. **码方案（旁路，非实时）**：任意一局选择状态索引化 → base64url 进 URL `#hash` → 对方打开（本地有完整 `mutatorPool`/指挥官表）→ 解码还原。**不经后端**，是"非实时选因子"的核心，与"减少人际沟通"直接对应。

### 2.3 为什么这套是"简洁 + 可扩展"

- **简洁**：前端一个 SPA，后端一个进程一个文件，nginx 加一行反代。练习/码方案无后端依赖 = 后端只承载"需要持久化的比赛域"，攻击面/运维面都最小。
- **可扩展**：配置层 `web/src/config/*` 做成与后端 JSON **同形**纯数据结构（见 §4、§5），将来"读本地 TS 常量"换成"fetch 后端 JSON"时，消费方签名不变；后端要加积分/天梯/反作弊逻辑就加 Go hook，不动前端。
- **自掌控**：数据全在开发机 SQLite + 对象存储副本，无第三方云锁定。

---

## 3. 架构剥离方案（让 `web/` 成独立全栈前端）

### 3.1 依赖现状（已核实，纠正一处用户记忆）

用户记忆"React 不依赖旧 TS"**不属实**——React **确实依赖**，但范围已被压到旧层中**纯逻辑/纯数据/纯类型**的薄子集，**不依赖 Cocos 引擎**：

- ✅ 不依赖 Cocos：3 个文件实测 0 个真实 `cc.*` 调用；唯一 `cc.log` 接触点已被 `web/src/cc-shim.ts` 13 行垫片接管。
- ✅ 不依赖 jjbDesign 的 Cocos 组件：`JJBSelect/JJBBattle/JJBObsBar/...` 等 cc.Component 子类 web/src 零引用，React 已自重写。
- ❌ 仍依赖 3 个旧 TS 文件（合计 449 行）+ 5 CSV + 图片目录，全部 `import-in-place`：

| React 实质 import 的旧文件 | 性质 | 剥离处理 |
|---|---|---|
| `JJConfigData.ts`（203 行） | **真业务逻辑（抽签引擎）**：母池解析/加权随机抽因子/消耗 | **必须整体内联，不能换桩** |
| `JijieData.ts`（95 行） | **纯静态状态容器**（全 `public static` + reset，无算法） | 内联，语义不变（仍是单例状态板） |
| `JJBData.ts`（151 行） | **纯函数+类型+常量**（facFlatIdx/manualSlots/sessionMatches/RESULT_VAL…），无 Cocos | 内联，改内部 `import JijieData` 为本地相对路径 |

**死链**：`JJConfigData.ts:1` 的 `import GameData` → `GameData.ts` → `PlayerData.ts`，唯一消费者 `calcCurrentScore()` 在 web/src 零引用 → 剥离时**断链删除**，省去搬两个文件。

### 3.2 剥离步骤（按工序，约 2 小时工程 + 1-2 小时验证）

| 步 | 动作 | 估时 |
|---|---|---|
| 1 | 复制 3 个逻辑文件进 `web/src/logic/legacy/`（或 `engine/`）；改 `JJBData` 内 `import JijieData`、`JJConfigData` 内 import 为本地相对路径 | 30 min |
| 2 | **断 GameData 死链**：删 `JJConfigData.ts:1` 的 `import GameData` 及唯一消费者 `calcCurrentScore()`，不搬 GameData/PlayerData | 10 min |
| 3 | 改 8 处 web import：`@logic/JijieData`（×3 App/HomeScreen/jjbSession）、`@logic/data/JJConfigData`（jjbSession）、`@jjb/JJBData`（×3 jjbSession/jjbDoubles/SelectScreen）全指本地 | 20 min |
| 4 | 搬 CSV：`assets/resources/jjdata/*.txt`（5 个/1.7KB）→ `web/public/jjdata/`，改 `jjbSession.ts:24` glob 路径 | 15 min |
| 5 | 搬图片：`assets/resources/images/`（**212 张/10MB**）→ `web/public/images/`，改 `realAsset.ts:7` glob 路径（纯拷贝，唯一体量项） | 30 min |
| 6 | 清 alias：删 `vite.config.ts` 两个 alias + `server.fs.allow` 收回 web 内 | 5 min |
| 7 | 回归：跑现有 4 套 Playwright（`jjb-verify`）+ 9 模式恒等式 e2e，确认 `__jjbDebug` 契约不变 | 1-2 h |

### 3.3 风险/注意点

1. **双源真相会断**：现 `vite.config.ts` 注释"Cocos 线与 React 线读同一份逻辑文件"，剥离=复制一份，两份各自演进。**建议先确认 Cocos 线存废**（看起来 React 已全屏重写、Cocos 线已弃用），弃用则顺手在 `assets/Script` 留 `DEPRECATED` 标记或后续删；仍维护则接受双份同步成本。
2. `JJConfigData` 不可 mock，必须整体内联。
3. 图片 10MB 进 `public/` 后 build 产物变大，但本就是 glob 捆绑、运行时已加载，**体积无净增**。
4. `mutatorPool.ts`/`aiEnemyPool.ts` 已是"剥离样板"（双打官突表已从 CSV 转 TS 常量）——5 个 CSV 也可仿此转 TS 常量连 glob 都省（见 §4，非必需）。

> **剥离与"接后端"的关系**：剥离让 `web/` 自包含，是接后端的**前置清场**但**不阻塞**——可与后端调研并行；剥离后码方案/截图等纯前端功能不再受旧层牵制。

---

## 4. config / CSV 梳理方案（单一真相源 + 适配后端）

### 4.1 现状：3 个互不连通家族 + 死数据，4 份重复

| 家族 | 路径 | 角色 | 运行期消费？ |
|---|---|---|---|
| **A jjdata** | `assets/resources/jjdata/*.txt`（5 个/CSV 逗号/无BOM/**CRLF**） | **单打运行期真相**（因子/指挥官/地图/规则参数/ban） | ✅ jjbSession.ts:24 glob → JJConfigData.init() |
| **B web/src/data** | `mutatorPool.ts`（138 官突，派生）+ `aiEnemyPool.ts`（19 敌方 AI，手写真相） | **双打+随机敌方运行期真相** | ✅ jjbDoubles / aiEnemySelector |
| **C docs** | `docs/*.csv`（3 个/UTF-8 BOM） | **人工母表**（官突池/挑战池/因子点数，比 jjdata 更全更权威） | ❌ grep 0 引用，仅生成期 |
| **D 死数据** | `assets/resources/data/*`（5 文件 + .meta） | Cocos 遗留旧 schema 祖先 | ❌ grep 0 引用 |

**核心病灶**：
1. **多真相源散乱**：指挥官档记录 **4 份**（jjdata + data/指挥官配置 + data/指挥官配置2 + jjbDoubles 硬编码）；官突池 **4 份**；因子点数 **2 份且不一致**（jjdata 42 个 vs docs 71 个）；地图 **2 份且数量不同**（13 vs 15）。
2. **手工副本漂移**：`jjbDoubles.ts` 把 `COMMANDER_A/B`、`FACTOR_SOURCE`、`FEIQIU_*` 硬编码进逻辑代码（注释标"源自指挥官配置.txt"实为拷贝），已**事实分叉**。
3. **派生产物无生成器**：`mutatorPool.ts` 头注称 "AUTO-GENERATED from docs/官突池.csv"，但仓库**找不到生成脚本**——"自动生成"实为一次性手动产物。
4. **编码脆弱耦合**：`JJConfigData.getStrArrFromFile` 硬 `split("\r\n")`，任何编辑器把 jjdata 改成 LF → 整表解析成一行 → **静默全空**。
5. **缺值靠白名单硬补**：jjdata 缺 `虚空重生者/混乱工作室/礼尚往来` 分值，靠代码 `FACTOR_SCORE_FALLBACKS` 补 7 分。

### 4.2 目标形态：`web/src/config/` 配置层（每类数据恰好一份）

```
人工母表 (非工程同学维护)        生成脚本                    运行期配置 (唯一被 import)
docs/*.csv (UTF-8 BOM)  ──► web/scripts/gen-config.ts ──► web/src/config/*.ts (强类型)
  因子点数配置.csv (71)          (CSV → TS 常量,            factors.ts / commanders.ts
  官突池.csv / 挑战池.csv         可同时输出 JSON)           maps.ts / rules.ts / bans.ts
                                  CI 校验"源改了产物没重生"   mutators.ts / aiEnemies.ts
```

**整理动作**：
1. **确立三层**：人工母表（docs CSV）→ 生成脚本 → 运行期强类型 TS（唯一 import 入口）。
2. **消灭 jjdata 5 txt 的运行期角色**：纳入生成脚本输出为 `web/src/config/{factors,commanders,maps,rules,bans}.ts`，`jjbSession.ts` 改 import 这些常量，**删掉 `import.meta.glob + getStrArrFromFile` 的 CRLF 脆弱解析链**。
3. **干掉硬编码副本**：`jjbDoubles.ts` 的 `COMMANDER_A/B`/`FACTOR_SOURCE`/`FEIQIU_*` 改 import `config/commanders.ts`。
4. **统一因子真相**：以 `docs/因子点数配置.csv`（71 因子，含 ban/限定/未实装）为唯一母表，废 jjdata 42 因子残表与 `FACTOR_SCORE_FALLBACKS` 白名单（缺值补进 CSV）。
5. **官突生成器补齐**：把 `mutatorPool.ts` 的 "AUTO-GENERATED" 落实为真脚本，并决定挑战池.csv（100 条自制突变当前闲置）是否纳入。
6. **清死数据**：`assets/resources/data/*` + .meta 归档/删除（grep 0 引用已确认）。
7. **后端数据化预留（关键）**：`web/src/config/*.ts` 导出做成与未来后端 JSON **同形**纯数据结构，生成脚本同时可吐 JSON。届时"读本地 TS 常量"→"fetch 后端 JSON"，消费方签名不变。建议对齐 §5.6 配置 schema。

> **与剥离的衔接**：§3 剥离把图片/逻辑搬进 web 后，§4 这步把"配置"也彻底 web 内化 + 单源化，`web/` 才真正自包含。两步可合并到同一前端 round。

---

## 5. 数据 schema 草案

> 设计原则：**对局/选手/积分/日志/账号 5 张核心表 + 配置数据表（可选）**。字段用 PocketBase 集合表达（systemfields `id`/`created`/`updated` 自带）。所有"指向枚举"的字段存**索引或稳定名**，与码方案、配置层同形。

### 5.1 `players` 选手表
| 字段 | 类型 | 说明 |
|---|---|---|
| `nickname` | text, required | 选手昵称（直播展示用） |
| `player_code` | text, unique | 选手稳定 ID（报名号/工会号，ObsScreen 展示） |
| `avatar` | file/url, optional | 头像 |
| `race_pref` | select(t/z/p), optional | 主玩种族 |
| `active` | bool | 是否在役 |
| `notes` | text, optional | 备注 |

### 5.2 `matches` 对局表（比赛+练习共用，模式区分）
| 字段 | 类型 | 说明 |
|---|---|---|
| `mode` | select(practice/match) | 练习 or 比赛（**入口分流落库点**） |
| `game_mode` | text | 赛制模式（A4B2 等 7 种模式之一） |
| `payload_code` | text | 选择状态的**索引化码**（与码方案同一编码，单字段可完整还原一局） |
| `payload_ver` | number | 码版本号（池重排时校验，见 §4/§7） |
| `players` | relation(players, multi) | 参与选手（练习可空/匿名） |
| `host` | relation(accounts) | 主持该局的主播账号（练习模式可空） |
| `result` | json | 每场胜负（RESULT_VAL 编码，对齐现有 `sessionMatches`） |
| `bp_config` | json | 本局 BP 规则快照（bpConfig 定稿，存快照防规则演进失真） |
| `started_at` / `ended_at` | date | 起止 |

> **一个设计要点**：`matches` 用 `payload_code` 单字段存整局选择，是因为 §4 调研实测——选择状态本质是"指向 `mutatorPool`/指挥官枚举的少量索引"，~100 bytes。**不必把 mutator 对象本身展开存表**，省表结构、与码方案天然一致、导出即可分享。完整展开的视图模型由前端解码渲染。

### 5.3 `scores` 积分表
| 字段 | 类型 | 说明 |
|---|---|---|
| `player` | relation(players) | 选手 |
| `match` | relation(matches) | 来源对局 |
| `delta` | number | 本局得分增量（Go hook 按 bp_config + result 计算） |
| `reason` | text | 计分依据（胜/负/难度系数/点金×2 等，可追溯） |
| `season` | text | 赛季标识（天梯分赛季） |

> 天梯**不单独建表**：天梯 = 对 `scores` 按 `season` 聚合（`SUM(delta) GROUP BY player`），用 PocketBase 视图或 Go hook 维护一个物化 `rankings` 排名缓存即可。读多写少，聚合廉价。

### 5.4 `logs` 操作日志表
| 字段 | 类型 | 说明 |
|---|---|---|
| `actor` | relation(accounts), optional | 操作者（系统事件可空） |
| `action` | text | 事件类型（match.create / score.adjust / login / config.reload …） |
| `target_type` / `target_id` | text | 受影响实体 |
| `detail` | json | 结构化上下文（前后值等） |
| `ip` | text, optional | 来源 |

### 5.5 `accounts` 账号表（主播权限）
> PocketBase **内置 auth 集合**直接承载，无需自建：
| 字段 | 类型 | 说明 |
|---|---|---|
| `email` / `password` | 内置 | 邮箱密码登录（或 OAuth2） |
| `role` | select(admin/host/viewer) | 权限角色（admin 管账号+改积分，host 主持比赛+写对局，viewer 只读） |
| `display_name` | text | 主播名 |

权限用 PocketBase **记录级访问规则**表达：`matches` 写规则 = `@request.auth.role = "host" || "admin"`；`scores` 改规则 = `@request.auth.role = "admin"`；练习模式相关读 = 公开。

### 5.6 配置数据表（可选，§4 后端化的落点）
当 §4 的"后端数据化预留"被启用时，把配置也搬进集合，schema 与前端 `config/*.ts` 同形：
- `Factor{ name, group, score, bannableSolo, bannableDouble, status }`
- `Commander{ name, tier(A/B), race(t/z/p) }`
- `Map{ name, group, modes }`
- `Mutator{ id, name, map, factors[], tier(A/B/C), points }`
- `AIEnemy{ id, race, nameZh, nameEn }`

> 在此之前，配置完全可留在前端 `config/*.ts`（练习/码方案根本不需要后端）。**这是"可扩展"的留口，不是 P5 的必做项。**

---

## 6. 分阶段路线图

> 排程原则：**前端 P1-P4 先行（Claude Design 设计轮），后端 P5 调研后接入，前后端并行**。下表 9 个工作项映射到 6 个 Phase，标注【线】=前端(Claude Design 联调) / 后端(/goal spoke loop)、并行性、依赖、可验证产出。

### Phase 0 — 架构清场（前端，1 天，强烈先做）
- **内容**：§3 剥离（搬 3 文件+5CSV+图片）+ §4 配置单源化第一刀（建 `config/` + 生成脚本骨架 + 清死数据）。
- **线**：前端（可 /goal spoke 跑，目标极可验证）。**依赖**：无。**并行**：与任何后端调研并行。
- **可验证产出**：删掉 `vite.config.ts` 两个 alias 后 `web/` 仍 build 通过；4 套 Playwright + 9 模式恒等式 e2e 全 PASS；`grep @logic\|@jjb web/src` = 0 命中。

### Phase 1 — 入口分流 + BP 规则落地（前端）
- **工作项**：入口分流（练习/比赛双模式）、BP 规则（已定稿）。
- **线**：前端 Claude Design 设计轮（双模式入口是高可见 UI）。**依赖**：Phase 0（配置层就绪更顺，非硬阻塞）。**并行**：与 Phase 5 后端调研并行。
- **可验证产出**：首页可选练习/比赛进入不同流程；BP 规则在选择流中生效（bpConfig 开关驱动锁定/可选因子），e2e 覆盖 BP 边界。

### Phase 2 — 截图导出（前端）
- **工作项**：截图导出。
- **线**：前端。装 `snapdom`，做"复制到剪贴板（Chromium 主路径）+ 下载（全端兜底）"双按钮。**依赖**：无（独立功能）。**并行**：可与 P1/P3/P5 全并行。
- **可验证产出**：选择/对局界面一键出图，`clip-path` 斜切框正确裁切（非方块）、SC2 中文不糊（截图前 `await document.fonts.ready`）、`scale:2~3` 高清；Chromium 复制成功、Firefox/移动端下载兜底。

### Phase 3 — 码方案：非实时选因子（前端）
- **工作项**：码方案。
- **线**：前端。索引化 JSON → base64url → URL `#hash`，**带版本号 `v`**，零依赖。**依赖**：Phase 0 配置层稳定（索引指向 `config`/`mutatorPool`，需稳定排序）。**并行**：与 P2/P5 并行。
- **可验证产出**：一局选择状态生成 ~150 字符短码；他端打开 URL 完整还原（指挥官+锁定因子+自选因子+模式）；池版本不匹配时提示"码版本过期"；码放 `#hash` 不进服务器日志。

### Phase 4 — 主播直播横条 + 选手 ID 展示（前端）
- **工作项**：选手 ID 直播展示（ObsScreen 已有雏形）。
- **线**：前端 Claude Design。**依赖**：选手 ID 的数据源——P4a 可先用前端本地/码携带的选手名跑通展示；P4b 接后端 `players` 表（需 Phase 5）。**并行**：UI 部分与后端并行，**数据接入需等 P5**。
- **可验证产出**：横条三形态 URL（`jjb-run-broadcast`）正确渲染选手 ID；主播采集 SOP 可用。

### Phase 5 — 后端搭建 + 接入（后端，/goal spoke loop）
- **工作项**：后端存储（对局/选手/积分/日志）、主播权限登录。
- **线**：后端 /goal spoke 自跑 loop（schema + 集合规则 + hook 是清晰可验证目标）。**依赖**：§5 schema 草案（本报告已给）；部署沿 `jjb-deploy`。**并行**：**整个 P5 可与 P1-P4 前端并行起跑**——后端独立产出 PocketBase 实例 + REST，前端 P1-P4 不阻塞；二者在"前端调 `/api`"处汇流。
- **可验证产出**：
  - PocketBase 起在开发机，nginx `/api` 反代通；Litestream 复制到对象存储成功（断电恢复演练）。
  - `matches/players/scores/logs/accounts` 5 集合 + 记录级权限规则就位。
  - 主播登录后能写对局、viewer 只读、admin 改积分；SQLite 文件可 `cp` 导出、Admin UI 可浏览。
  - 前端比赛模式 `fetch /api` 成功落库一局并回读。

### Phase 6 — 积分 / 天梯（后端为主，前端展示）
- **工作项**：日志（贯穿，P5 已埋点，P6 补齐审计视图）、积分天梯。
- **线**：后端 Go hook（积分计算 + 天梯聚合）+ 前端天梯页（Claude Design）。**依赖**：Phase 5（matches/scores 表）+ 积分算法定稿（见 §7 开放问题）。**并行**：算法定稿前可先做天梯展示 UI（前端）与日志审计视图。
- **可验证产出**：一局结束 hook 自动算分写 `scores`；`rankings` 按赛季聚合正确；天梯页展示排名；关键操作可在 `logs` 审计追溯。

### 路线图速览（并行泳道）

```
时间 →
前端泳道  [P0 清场]─[P1 分流+BP]─[P2 截图]─[P3 码方案]─[P4 横条UI]──────[P6 天梯页]
                          (P2/P3 可互相并行)         │
                                                    │ 汇流: 前端调 /api
后端泳道       [P5 调研]──[P5 PocketBase+schema+权限+部署+Litestream]──[P6 积分hook+天梯聚合]
```

**关键并行结论**：P0–P4 是**纯前端**（Claude Design 联调），P5 后端 /goal spoke **同时起跑**；唯一硬汇流点是 P4b（选手 ID 接 `players`）和比赛模式写库（P1 比赛分支落库），都在 P5 后端就绪后接线。**前端 1-4 先行、后端调研后接入、前后端并行**的诉求完全成立。

---

## 7. 开放问题 / 风险（留给用户拍）

| # | 问题 | 现状/选项 | 建议 |
|---|---|---|---|
| 1 | **积分天梯算法未定稿** | 胜负基础分？难度系数（点金×2 是否计分）？赛季周期？连胜加成？Buchholz/Elo/纯累加？ | 这是 P6 的硬前置。**先拍最简方案（每局胜负 × 难度系数纯累加 + 按赛季 SUM）**，Elo/天梯精算后续迭代；schema 已用 `delta+reason+season` 留足空间 |
| 2 | **码方案编码上限/版本演进** | `mutatorPool.ts` 注释明确 CSV 自动生成、**会变**；池重排旧码错位 | **必带 `v` + 解码校验池长度/哈希**；池调整走"追加不重排"纪律，或码里存稳定名而非纯下标。当前 ~100 bytes 离 2000 上限极远，**不需要 lz-string/后端短链**，留作"将来要塞完整自定义一局（脱离枚举）"时再上 |
| 3 | **练习数据量级 / 是否落库** | 练习若全量写库，写入量远大于比赛 | 建议**练习默认纯前端不落库**（§2 主线 1），仅"选手主动保存"才写；避免 SQLite 写压力，也契合"提效降本"。若要统计练习热度，用轻量计数而非全量存局 |
| 4 | **SC2 中文字体版权** | 截图/直播横条用 SC2 主题中文字体，对外发布有版权暴露 | 确认字体授权范围；截图 `embedFonts` 会把字体内嵌进产物，**放大版权面**。建议核对字体 license，或换可商用替代字形 |
| 5 | **架构剥离工作量 / Cocos 线存废** | 剥离=复制一份逻辑，双源真相断裂；Cocos 线疑似已弃用 | **先确认 Cocos 线是否还维护**：弃用则剥离零负担（顺手标 DEPRECATED）；仍用则需接受双份同步成本。剥离本体半天～1 天、低风险，建议**Phase 0 先做** |
| 6 | **PocketBase 未到 v1.0** | 升级偶有破坏性变更 | 锁版本、升级前 `cp` 备份 SQLite（就一个文件）、非赛季窗口升级。数据是标准 SQL，迁 Directus/PG 路径不堵 |
| 7 | **挑战池.csv（100 条自制突变）去留** | 当前完全闲置未进代码 | 决定是否纳入 `mutators` 生成——若练习模式想开放"高难自制突变"，这是现成素材；否则归档 |
| 8 | **比赛模式与码方案的关系** | 比赛是否也用码导入开局，还是后端直接派 | 建议比赛模式 `matches.payload_code` 与码方案**复用同一编码**（§5.2），主播可"贴码开局"，统一两条路径、减少代码 |

---

**关键文件绝对路径速查**
- vite alias / 剥离落点：`/Users/bytedance/项目/jijiebei/web/vite.config.ts`
- React 依赖的 3 个旧文件：`/Users/bytedance/项目/jijiebei/assets/Script/jijie2/JijieData.ts`、`.../jijie2/data/JJConfigData.ts`（抽签引擎，活逻辑，不可换桩）、`.../jjbDesign/JJBData.ts`
- 死链候选（剥离断链删）：`.../jijie2/data/GameData.ts` + `PlayerData.ts`
- 接缝层：`/Users/bytedance/项目/jijiebei/web/src/logic/jjbSession.ts`（唯一调引擎）、`/Users/bytedance/项目/jijiebei/web/src/cc-shim.ts`（13 行 Cocos 垫片）
- 运行期单打真相：`/Users/bytedance/项目/jijiebei/assets/resources/jjdata/*.txt`（5 CSV，CRLF 脆弱）
- 运行期双打/敌方真相：`/Users/bytedance/项目/jijiebei/web/src/data/{mutatorPool,aiEnemyPool}.ts`
- 人工母表（生成期）：`/Users/bytedance/项目/jijiebei/docs/{因子点数配置,官突ABC配置_官突池,官突ABC配置_挑战池}.csv`
- 死数据（建议清理）：`/Users/bytedance/项目/jijiebei/assets/resources/data/*`
- 码方案/截图相关：`/Users/bytedance/项目/jijiebei/web/src/screens/SelectScreen.tsx`（选择状态真实形状）、`/Users/bytedance/项目/jijiebei/web/src/screens/ObsScreen.tsx`（直播横条）

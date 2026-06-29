# 集结杯 P2–P5 + config cutover + 2 遗留 · 可执行推进编排

> 真相锚点：`projectplan.md` L2150–2236（路线图 + P0/P1 完成记录）、L1760–1924（React 切换/OBS/双打调研）、`docs/claude-design-loop.md`（设计闭环 SOP）。
> 现状：分支 `jjb-platform`（本地领先 origin），P0 清场 + P1 入口分流/BP 已收口。栈 = React `web/src`，Cocos 冻结。
> 红线（每个 spoke 契约必带）：`assets/Script`、`assets/resources`、`design/`、`web/src/logic/legacy/` **零 diff**；CSS 走 web 侧覆盖；不自行 commit/push（hub 收口）。

---

## 1. 依赖图 / 顺序

### 1.1 泳道划分（两条主泳道 + 一条设计前置带）

```
                          ┌─────────────────────────── 设计前置带（Claude Design Prototype，人工出稿）───────────────────────────┐
                          │  D-A 主播横条/选手ID面板视觉   D-B BP违规提示+码方案入口微调(并 P1遗留①)   (D-C light/minimal 巡检=校验非新稿) │
                          └──────┬──────────────────────────────────┬───────────────────────────────────────────────────────────┘
                                 │ 出稿→DesignSync读→落地              │
   ┌─────────────────── 前端泳道（web/src，spoke=Claude session /goal 为主）──────────────────────────────────┐
   │                                                                                                          │
   │  P2 截图导出(snapDOM) ──┐                                                                                  │
   │       (纯前端,无设计依赖) │                                                                                 │
   │                          ├──► P3 码方案(URL #hash 编解码) ──► [编码契约] ──┐                               │
   │  P4 主播横条+选手ID ◄─D-A ┘        (纯前端逻辑,可早起跑)        共享 payload  │                              │
   │       (UI数据先占位,后接/api)                                  编码         │                              │
   │                                                                            ▼                              │
   │  config cutover(运行期切 config/*.ts) ──(独立,触 9 模式 e2e)──────────► 全回归汇流                         │
   └──────────────────────────────────────────────────────────────────────────┬─────────────────────────────┘
                                                                               │  汇流点 = 前端比赛模式 fetch('/api/...')
   ┌─────────────────── 后端泳道（PocketBase，spoke=Codex /goal loop，与前端全程并行）─────────┐  │
   │  P5 PocketBase 5集合 schema + 记录级权限 + nginx /api 反代 + Litestream 容灾  ───────────────┘
   └──────────────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 哪些 design 先行（出 brief → 用户 claude.ai/design 出稿 → hub DesignSync 落地）

| 设计项 | 服务于 | 为何必须先 design | 产出物 |
|---|---|---|---|
| **D-A 主播横条 + 选手 ID 展示面板** | P4 | 横条三皮肤×明暗的几何/字号/选手ID突出框是视觉契约，repo 现有 ObsBar 是 v4 老结构，需新稿对齐「比赛平台」定位 | hub 出 brief → Prototype URL → `get_file <Name>.dc.html`+css |
| **D-B BP 违规提示 toast + 码方案入口** | P1遗留① + P3 | P1b 已落 toast 行为但「规则点设计稿本空白」（projectplan L2232）；P3 码方案需要「分享/导入码」入口按钮的视觉位 | 同上，**可与 D-A 合并成一个 Prototype 出稿轮**省一次人工交接 |
| **D-C light/minimal 皮肤巡检** | P1遗留② | 这是**校验任务非新稿**：P1a+P1b 只验了 sc2-dark，light/minimal 是否破版未知 | 不出新稿；hub/spoke 截图核对，破了才回 Claude Design 改 token |

### 1.3 哪些 spoke 直接执行（纯逻辑/前端，无设计依赖）

- **P2 截图导出**：snapDOM 集成纯技术活，不需新视觉 → spoke 直接起跑（**可立即开**）。
- **P3 码方案**：URL `#hash` 索引化 JSON 编解码纯逻辑 → spoke 直接起跑；仅「入口按钮」等 D-B（按钮可先用临时样式，逻辑不阻塞）。
- **P5 后端**：schema 已草拟（projectplan L2172 / 报告 §5），纯后端 → Codex /goal loop **全程独立并行**。
- **config cutover**：运行期把 `jjbSession` 的 `data/jjdata` glob 切到 `config/*.ts`，纯逻辑但**触 9 模式 e2e**（行为等价验证）→ spoke 直接执行但需重回归。

### 1.4 可并行 vs 汇流点

- **可并行**：前端泳道（P2/P3/P4/cutover）与后端泳道（P5）**全程互不阻塞**。P5 产出 PocketBase 实例 + REST，前端在「比赛模式 `fetch('/api')`」处才汇流。
- **前端泳道内并行**：P2 与 P3 互不依赖可并行；P4 等 D-A 设计；cutover 独立可任意时刻插入（但建议避开其它 phase 的回归窗口，单独验）。
- **关键内部耦合**：**P3 码方案的编码 ⊃ P5 `matches.payload_code` 编码**——同一索引化编码（projectplan L2186「比赛模式复用码方案编码」、报告 §5.6「payload_code 与码方案同一编码」）。→ P3 必须先冻结编码 schema，P5 的 `payload_code` 直接复用，**否则前端编码与后端存储不一致**。
- **汇流点**：① 前端比赛模式 `fetch('/api/...')` 落库一局并回读（P4-数据 × P5）；② P4 选手 ID 展示数据来自 P5 `players`/`accounts`（先 UI 占位，后接真数据）。

---

## 2. 推进批次（3 批）

### 批 1 · 即刻起跑（无设计依赖的纯逻辑/后端，最大化并行）

| 任务 | 走 design / spoke | 依赖 | done-when |
|---|---|---|---|
| **P2 截图导出（snapDOM）** | spoke（Claude /goal） | 无 | snapDOM 集成 web/src；select/battle/result/obs 任一屏一键导出 PNG，**clip-path 斜切 + SC2 中文字体不糊不裂**（foreignObject 路线）；不污染三皮肤 token；build EXIT=0 + 4 套 e2e 全绿 |
| **P3 码方案编解码核心** | spoke（Claude /goal） | 无（**先冻结编码 schema 供 P5 复用**） | 索引化 JSON→base64url 进 URL `#hash`（~100B，带版本号 v+校验，对齐 L2186）；`encode(selectState)↔decode` 往返 9 模式 + 双打全等价；编码 schema 文档化（= P5 `payload_code` 契约）；e2e 加往返断言 |
| **P5 后端 PocketBase（独立泳道）** | spoke（**Codex /goal loop**） | 无（schema 已草拟） | PocketBase 起在 devbox-tianlang（第二容器/裸进程，挂持久卷）；5 集合 players/matches/scores/logs/accounts 按 L2172 建；记录级权限（host 写 matches、admin 改 scores、练习读公开）；nginx 加 `location /api` 反代 :8090 同源；Litestream 复制到对象存储 + 断电恢复演练通；前端可 `fetch('/api')` 落一局回读 |
| **D-A + D-B 设计出稿（人工前置）** | **design 先行**（hub 出 brief → yb 出 Prototype） | hub 先产 brief | hub 给「主播横条+选手ID面板」+「BP违规toast+码方案入口」brief → yb 在 claude.ai/design 出 Prototype（绑「集结杯 Design System」`e956fe00`）→ **把项目 URL 给 hub** → hub `get_file` 读到 `.dc.html`+css |

> 批 1 三条 spoke 任务 + 一条 design 出稿可同时在飞。**D-A/D-B 出稿是 P4 的人工前置，越早派 brief 越好**（人工出稿有延迟）。

### 批 2 · 设计落地 + 前端汇流（依赖批 1 产出）

| 任务 | 走 design / spoke | 依赖 | done-when |
|---|---|---|---|
| **P4 主播横条 + 选手 ID 展示** | spoke（Claude /goal）落地 D-A 稿 | D-A 出稿完成 + P5 schema（选手数据接口） | 按 D-A `.dc.html` 重构 ObsBar/选手ID框，三皮肤×明暗对齐；选手 ID 突出框 + LIVE 状态；数据先 P5 占位接口、后接真 `players`；OBS 1280×720 契约不破（ObsScreen 固定 720，projectplan L1780）；build+e2e 绿 |
| **P3 码方案入口 UI** | spoke 落地 D-B 入口稿 | D-B 出稿 + P3 编解码核心 | 「分享码/导入码」按钮接 D-B 视觉位；点享→生成 URL、粘码→还原局；与 P3 核心联通 |
| **P1 遗留① BP 违规提示 UI 视觉** | **design 微调**（D-B 含）→ spoke 落地 | D-B 出稿 | toast 视觉按 D-B 稿对齐（现为临时复用渲染，L2230）；行为不回归（match 软违规弹、practice 不弹） |
| **前端↔后端汇流联调** | spoke（Claude /goal，联调敏感） | P4 + P5 均就绪 | 比赛模式端到端：登录(host)→选因子→开始→落库 matches(payload_code)→回读渲染；练习模式默认不落库（L2185）；选手 ID 直播展示真数据 |

### 批 3 · cutover + 巡检 + 收尾（独立可错峰）

| 任务 | 走 design / spoke | 依赖 | done-when |
|---|---|---|---|
| **config cutover（运行期切 config/*.ts）** | spoke（Claude /goal，回归敏感） | config 单源化补全（commanders/mutators/maps/rules/bans，现仅 factors） | `jjbSession` 从 `data/jjdata/*.txt` glob 切到 `config/*.ts`；**删 CRLF/BOM 脆弱解析链**；**9 模式 e2e + 4 套 Playwright 行为逐字节等价**（这是硬验证门，projectplan L2202「行为变更需单独回归」）；虚空重生者 7 分/混乱工作室白名单等 fallback 不漂移（L859-898） |
| **P1 遗留② light/minimal 皮肤巡检** | spoke（截图核对）；破了才回 design | 批 1/批 2 UI 落定后 | 6 皮肤×5屏（含新 P4 横条）截图核对；light/minimal 无破版/溢出；破版项回 Claude Design 改 token（不手改 design/） |
| **P6 积分/天梯**（路线图后续，可挂批 3 尾） | spoke（后端 hook + 前端展示） | P5 落库通 | scores 按 season 聚合天梯；最简「胜负×难度系数累加」（L2185），前端天梯卡接真数据 |

---

## 3. 派发建议（每个 spoke 任务推荐入口 + 理由）

> 路由依据 = projectplan A3「按判断密度分」：**Codex /goal = 机械/批量/样板**；**Claude session /goal = 灵活/保真/联调敏感**。会写码 → copy-paste 审一遍再粘（agent-dispatch 安全硬规则）。

| 任务 | 推荐入口 | 理由 |
|---|---|---|
| **P5 后端 PocketBase** | **Codex /goal loop** | schema/集合规则/hook 是「清晰可验证目标」（报告 §6），机械度高、独立泳道自跑 loop 最划算；部署沿 `jjb-deploy` skill 配方。**走 harness-pro 多 phase round**（≥3 phase：schema+权限 / 部署+反代 / Litestream+联调），契约带 done-when |
| **P2 截图导出 snapDOM** | **Claude session /goal** | clip-path 斜切 + SC2 中文字体是**保真敏感**（foreignObject 路线需逐皮肤目检），Claude 像素判断更稳 |
| **P3 码方案编解码** | **Claude session /goal** | 编码 schema 要与 P5 `payload_code` 对齐（跨泳道契约），需判断版本/校验/边界，非纯样板；且往返等价性需设计断言 |
| **P4 主播横条落地** | **Claude session /goal** | 设计稿保真 + OBS 1280×720 契约 + 数据接口联调，多重保真/联调敏感 |
| **config cutover** | **Claude session /goal** | 触 9 模式 e2e、fallback 语义（虚空重生者/混乱工作室白名单）易漂移，**回归敏感**需逐项验等价，不可机械替换 |
| **前后端汇流联调** | **Claude session /goal** | 端到端联调（登录/落库/回读）判断密度高 |
| **light/minimal 巡检** | Claude session /goal（截图核对）或 hub 直接 read-only subagent | 视觉核对，量小；破版回 design |
| **D-A/D-B brief 起草** | **hub 直接产**（非 spoke） | brief 由 hub 出 → yb 在 claude.ai/design 出稿（人工），不派 spoke |

**harness-pro 适配**：P5（后端）、config cutover、P3、P4 均属「写 repo/改行为/产 runtime artifact」→ 默认进 harness-pro round（repo adapter = `HARNESS-PRO-ADAPTER.md`，runtime 全 gitignored）。reviewer alias 用 `/v1/models` live probe 的合法 alias（禁 internal key）。

---

## 4. 风险 / 卡点预告

1. **config cutover 触 9 模式 e2e（最高风险）**：`jjbSession` 现读 `data/jjdata/*.txt` glob（L24-57），切到 `config/*.ts` 是**运行期行为变更**。config 单源现仅 `factors.ts` 一类（L2202），**commanders/mutators/maps/rules/bans 五表生成脚本未补**——cutover 前必须先把 `gen-config.mjs` 的 TABLES 补全五表并逐表核对。fallback 陷阱：虚空重生者 7 分、混乱工作室/礼尚往来白名单（L859-898）若解析链一换就回落「未知=7」会污染分值。→ **cutover 单独成一个回归 phase，9 模式池=槽恒等式 + 4 套 e2e 必须逐字节等价**，不与其它 phase 混批。

2. **P3 码方案 ↔ P5 `payload_code` 编码复用（跨泳道契约）**：两者共用同一索引化编码（L2186、报告 §5.6）。若 P3、P5 各自起跑而不先冻结编码 schema → 前端生成的码与后端存储格式不一致，汇流时返工。→ **P3 先产「编码契约文档」作为 P5 `payload_code` 的 done-when 输入**；P5 spoke 契约显式引用该文档。索引指向 `mutatorPool`/指挥官枚举，**枚举顺序一旦变更码即失效** → 编码带版本号 v + 校验池（L2186 已定）。

3. **PocketBase 部署外网受限（部署政策硬约束）**：开发机 devbox-tianlang 外网受限（记忆 jjb-public-deploy-policy：内网穿透严禁）。PocketBase 起在开发机走 nginx `/api` 同源反代没问题；但**对外公网仍是 CF Pages 静态托管**——比赛模式要公网可写库时，CF Pages（静态）→ 如何打到开发机 PocketBase 是开放卡点（CF Pages 前端 + 开发机后端跨域/可达性）。→ P5 done-when 先锚「开发机内网 `/api` 通 + Litestream 容灾演练」；**公网可达方案（CF Pages → 后端）单列待 yb/SRE 决策**，不阻塞 P5 内网闭环。练习/码方案无后端依赖（报告架构图），公网纯静态可先上。

4. **双打仍未接驳（最大潜在工作量，未在本批次）**：`web/src/logic/jjbDoubles.ts` 已有 web 引擎（R7 Phase4 接 mutatorPool + 飞球之轮），但 **HomeScreen soon 占位、App 无 doubles 路由、jjbSession 不 import**（L1899/L1814）。且双打赛制有**三套互斥真相未拍死**（L1917：飞书占位骨架 vs yb 6-18 定稿 vs 三方对齐规则一）+ 飞球双打「抽不抽官方突变」未澄清（L1919）。→ **本编排不含双打**；双打是独立 ≥3 phase round，**硬前置 = yb 拍死赛制 + 飞球定义**（9 个待拍板项 L1916-1925），且需 DoublesSelect 设计稿（设计轮前置）。先推 P2-P5 不碰它。

5. **设计闭环的人工交接延迟**：Prototype URL `list_projects` 列不出（SOP §2），**必须 yb 手动给 hub**。D-A/D-B brief 越早派、yb 越早出稿，P4/P1遗留① 才不被卡。→ 批 1 就派 brief，把人工出稿挪到关键路径之外。

6. **cutover 与 React 收尾的口径冲突**（次要）：HomeScreen 露 6 模式 vs 逻辑 9 模式 vs 赛制 7 模式三口径未统一（L1837）。config cutover 校 9 模式 e2e 时会再撞这个口径——**cutover 不负责统一口径**（独立收尾项 L1846），但回归断言要明确按「9 逻辑模式」跑，避免 e2e 与 home 露出数不一致引发误判。

7. **harness reviewer 盲审 / gate 配置缺口（流程风险）**：历史多 phase reviewer 因 evidence 缺真 diff 盲审（L70/L117/L1838 DUBHE_API_KEY UNSET + reviewer_config_drift）。→ P5/cutover 等关键 round 的 gate 不能只靠 reviewer verdict 当上线许可，**确定性验证（build0 + 9模式e2e + 落库回读 + 容灾演练）才是真 gate**；reviewer 走 advisory，起跑前 live probe alias 与 payload shape。

---

**附：关键文件锚点（spoke 契约可直接引用，均绝对路径）**
- 编排真相：`/Users/bytedance/项目/jijiebei/projectplan.md`（路线图 L2150-2236 / OBS·双打调研 L1760-1924）
- 设计闭环 SOP：`/Users/bytedance/项目/jijiebei/docs/claude-design-loop.md`
- 平台调研全文（schema §5 / 部署 §1.2 / 并行 §6）：`/Users/bytedance/项目/jijiebei/tmp/platform-research-report.md`
- config 单源骨架：`/Users/bytedance/项目/jijiebei/web/src/config/`（`index.ts`/`factors.ts`/`README.md`）
- cutover 触点：`/Users/bytedance/项目/jijiebei/web/src/logic/jjbSession.ts`（glob L24-57 / fallback L859-898）+ `/Users/bytedance/项目/jijiebei/web/scripts/gen-config.mjs`
- 双打引擎（暂不接）：`/Users/bytedance/项目/jijiebei/web/src/logic/jjbDoubles.ts`
- e2e 验证门：`/Users/bytedance/项目/jijiebei/web/e2e/`（`run.mjs` 9模式 / `ui-smoke.mjs` / `r6-doubles-downstream.mjs` / `random-enemy.mjs` / `bp-rules.mjs`）
- 屏幕落地点：`/Users/bytedance/项目/jijiebei/web/src/screens/`（`ObsScreen.tsx`/`BpConfigScreen.tsx`/`SelectScreen.tsx` 等）
- Design System：「集结杯 Design System」`e956fe00`；部署 skill：`jjb-deploy`（devbox-tianlang docker nginx :8080）

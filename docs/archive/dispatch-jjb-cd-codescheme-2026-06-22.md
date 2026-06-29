# 集结杯 C+D 码方案前端派发契约 — Claude Code spoke

> **执行位**：Claude Code（GLM-5.2 经 Dubhe，或 Claude 原生——hub 给命令时定）。
> **⚠️ 纯文本工作，禁止任何图片/截图/二进制输入**（曾因误贴图片触发 `400 content type` 崩 session）。
> **本文件即 `/goal` 全文**：spoke 第一个工具调用 Read 本文件读全再开工；读不到立即 STOP。
> **设计真相**：`web/src/styles/code-scheme.css`（hub 已落，class/token 真相）+ 本文件末尾「附录：屏 C/D DOM 结构」。承接 Claude Design 项目 19b54387。
> **harness-pro round**：planned_phases=3。

<!-- dispatch_contract:v1 target=claude-session entry=goal harness=on planned_phases=3 -->

<objective>
  实现集结杯「码方案」一对屏（生成码 C + 贴码开局 D）+ 编解码核心 codec.ts + 路由入口 + e2e。
  「非实时码方案」= 主播把一局选因子结果固化成可复制对局码，发给选手离线对照（避免实时沟通）。
  与 P5 后端 matches.payload_code 复用同一编码器——本 round 先冻结编码 schema 并文档化（P5 复用）。
</objective>

<scope>
  可以动（新增为主）：
  - web/src/logic/codec.ts（新）：encodePayload/decodePayload，索引化编码
  - web/src/screens/CodeScreen.tsx（新）：一稿两屏（prop screen 'gen'|'paste'），承接 code-scheme.css
  - web/src/styles/code-scheme.css（hub 已落，仅对齐 repo token 微调——如 --vbtn-bg 缺失则补定义或换 var(--panel-bg)）
  - App.tsx：加 code 屏路由 + 入口（生成码 / 贴码开局），不改现有屏逻辑
  - web/e2e/：新增 codec 往返 e2e（9 模式 + 双打全等价）
  - web/src/main.tsx：import './styles/code-scheme.css'

  只读对接（读懂形状，不改）：
  - web/src/logic/jjbSession.ts（getSelectState/SelectState/SessionMode/getScore/winLoseList）
  - web/src/logic/jjbDoubles.ts（getDoublesState/DoublesConfig/_slots）
  - web/src/logic/jjbView.ts（门面 currentMatches/currentScore）
  - web/src/components/FactorFrame.tsx（.fx 因子卡，摘要卡复用）+ 指挥官卡组件（.cc 语言）
  - web/src/lib/designAssets.ts + realAsset 接法（facUrl/指挥官图/地图图 真图，213 张在 web/src/images）
  - web/src/screens/SelectScreen.tsx（看现有屏结构 + toast/startbtn 语言 + bp.css 的 .toastv.soft 复用）

  不要动（红线零 diff）：
  - assets/Script、assets/resources、design/、web/src/logic/legacy/（Cocos/XP 冻结）
  - 现有屏（Home/Select/Battle/Obs/Result/BpConfig）逻辑——只新增 CodeScreen + 入口
  - 不自行 git commit/push；密钥仅临时 env、不落盘进 git

  编码 schema 关键约束（与 P5 复用）：
  - 索引化：指挥官→commanderList 下标 + 稳定名；因子→mutatorPool 下标 + 稳定名；地图/敌方种族AI/模式同理
  - 池追加不重排纪律：编码带 payload_ver + 校验（池长度/哈希），旧码遇池重排不错位、提示「码版本/池不符」
  - 两条路径都要编：单打 SelectState + 双打 DoublesState（jjbView 门面分流）

  码格式（关键决策，契约定，spoke 照做）：
  - **自包含 base64url 码为主**：encodePayload(state)→索引化 JSON→base64url，进 URL #hash（目标 ~100-150B），decode 无需后端、自还原。这是 P3 调研定的技术路线。
  - 设计稿展示的短码「JJB-8F-3K9Q-2M7X」是「人工速记引用码」视觉——引用码需后端存 payload + 查表（依赖 P5），**本 round 不做**；码区 .code-val 先展示自包含码（可分段/截断展示，完整码在复制内容 + URL hash）。
  - 即：本 round = 自包含编解码 + URL #hash 分享 + 贴码还原；引用式短码 UI 留占位、待 P5 后端就绪接。
</scope>

<validation>
  done-when：
  - codec.ts：encodePayload(getSelectState())↔decodePayload 往返，**9 模式 + 双打全字段等价**（指挥官/锁定因子/自选因子/地图/敌方/模式/点金/winLoseList）
  - URL #hash 编码 ~150B 内；payload_ver + 校验（构造池长度变化场景，decode 报「码版本/池不符」而非错位还原）
  - 屏 C 生成码：摘要卡 3 场（复用 FactorFrame/指挥官卡 + realAsset 真图，不用设计稿占位图）+ 码区 .code-box + 复制（navigator.clipboard + 1.8s done 反馈）+ 元信息 4 cell + 操作行；三皮肤×明暗成立、1280×720 不溢出
  - 屏 D 贴码：.code-field 输入 + 解析（合法→摘要预览复用屏C；非法/版本不符→.toastv.soft 失败 banner 复用 Brief A bp.css）+「按此码开局」（startbtn，未解析时 .blocked；解析成功 decode→进对照/battle）
  - 路由：home 或 select 有「生成码 / 贴码开局」入口接通 CodeScreen
  - 编码 schema 文档化 docs/codec-schema.md（字段顺序 + 索引基准 + 版本 + 校验）= P5 matches.payload_code 复用契约
  - build0 + tsc0 + 全套 e2e（run/ui-smoke/bp-rules/random-enemy/r6-doubles）不回归 + 新 codec e2e 绿

  proof（spoke 真实跑并贴回原文）：
  <pre lang="bash">
  cd /Users/bytedance/项目/jijiebei/web && npx tsc --noEmit && npm run build 2>&1 | tail -3
  node e2e/codec.mjs            # 往返等价 + 版本校验断言
  for f in run ui-smoke bp-rules random-enemy r6-doubles-downstream; do node e2e/$f.mjs 2>&1 | tail -2; done
  </pre>

  【六硬约束】①不跳phase顺序②review/gate/audit只许CLI驱动session产生③frozen与runtime只读④禁伪造PASS⑤证据只引pre-review事实⑥不确定/失败/超预算→停下汇报
</validation>

<stop_when>
  - 需改现有屏逻辑/引擎才能完成 → STOP（只加 CodeScreen + 入口，不动现有屏）
  - 需改 assets/Script、assets/resources、design/、web/src/logic/legacy/ → STOP（红线）
  - 编码 schema 与 P5 已落的 payload_code 冲突 → STOP 交 hub 协调（P3/P5 复用同编码，hub 是唯一裁决）
  - 本契约文件 Read 失败或为空 → STOP
  - ⚠️ 收到任何图片/截图/二进制输入 → 不处理、纯文本继续；若底座 API 报 content type / 400 → 立即 STOP 报告（这是上一轮崩 session 的根因，绝不重蹈）
  - harness phase gate BLOCKED 且非假阳性 → STOP 交 hub
  max_iterations: 25
  max_duration: 3h
</stop_when>

<context>
  必须先读（按序）：
  - web/src/styles/code-scheme.css（class/token 真相，hub 已落）
  - 本文件末尾「附录：屏 C/D DOM 结构」
  - docs/research-frontend-p2p3.md（P3 码方案编解码调研：索引化/版本/URL 上限/池纪律）
  - web/src/logic/jjbSession.ts + jjbDoubles.ts + jjbView.ts（选择状态权威形状 = 编码源）
  - web/src/components/FactorFrame.tsx + web/src/screens/SelectScreen.tsx（卡片/toast/startbtn 复用语言；.toastv.soft 来自 bp.css）
  - web/src/lib/designAssets.ts（realAsset/facUrl 真图接法）

  已定真相（不要重新论证）：
  - 自包含 base64url 码（非引用式短码）；引用短码留 P5 占位
  - codec 与 P5 payload_code 复用；本 round 冻结 schema 文档化
  - 设计稿短码是展示视觉、实际码自包含；摘要卡用 realAsset 真图
  - 失败提示复用 Brief A 的 .toastv.soft（bp.css 已落）
</context>

<motivation>
  码方案是「比赛/分享两条路径统一」的关键：主播生成码→选手贴码开局，离线对照不靠实时沟通；
  同一编码器又是 P5 后端 matches.payload_code 的存储格式——做对一次，前端分享 + 后端落库 + 主播贴码三处复用零重复。
</motivation>

<persistence>
  Keep going until fully resolved. 服从 stop_when 优先于 persistence。纯文本工作，不碰图片。
</persistence>

---

## Harness-Pro Round 配方（planned_phases=3）
写 repo/产 runtime → 走 harness round。起跑前 invoke harness-pro skill + 读 repo adapter 拿当前真相，doctor + （若经 Dubhe）live probe /v1/models 确认 reviewer alias 与执行底座 disjoint。init 后每条 CLI 显式 --runtime-dir "$RT"，review 显式 --model-config。
**3 phase**：① codec.ts 编解码核心 + schema 文档 + 往返 e2e ② CodeScreen 两屏 UI（承接 code-scheme.css）+ 路由入口 ③ 全回归（build/tsc/5 套 e2e 不漂移）+ 三皮肤目检。确定性验证（往返等价 + build0 + e2e）才是真 gate，reviewer advisory。

---

## 附录：屏 C / D DOM 结构（从设计稿 19b54387 提炼，class 见 code-scheme.css）

容器：`.jjb.style-X.mode-Y` > `.jjb-bg`(grad/tex/vignette) + `.jjb-inner.code-screen`（gap:16px）。顶部 `.topbar`（.lockup 品牌 + .topbar-meta 模式/「对局码方案·非实时」）。

### 屏 C（生成码，screen='gen'）
- `.block-head`：.block-kicker「GENERATE CODE」+ .block-title「生成对局码」+ .block-note「把本局选因子结果固化 · 发给选手离线对照」
- `.csum`（grid 3 列）× 3 `.csum-card`：
  - `.csum-head`：.csum-no「第 1 场/第 2 场/BOSS 战」+ .csum-diff「难度 N」+（BOSS）.csum-dbl「双倍」
  - `.csum-map` > .mapthumb img（地图缩略，realAsset 真图）
  - `.csum-line`：.csum-cmds（.cc 指挥官卡 56×67，复用现有指挥官卡）+ .csum-facs（.fx 因子 52，复用 FactorFrame：锁定 tag / gold 点金 bp-gm）
- `.code-box`：.code-box-lbl「对局码」+ .code-val（大号 --font-num 码，.seg-dash 分段）+ .code-copy 按钮（copied→.done「已复制」对勾 / 默认「复制对局码」）
- `.code-meta`：4 × .meta-cell（模式「8 因子·手选」/ 难度总分 .big「47」/ 生成时间 / 码版本「v4」）
- `.code-actions`（margin-top:auto）：startbtn「复制对局码 ▶」+ btn-ghost「重新生成」+ .spacer + btn-ghost「返回」

### 屏 D（贴码开局，screen='paste'）
- `.block-head`：「PASTE CODE」/「贴码开局」/「粘贴主播·裁判发来的对局码 · 离线对照开局」
- 输入行：`.code-field`(.focus 态) > input（placeholder「粘贴对局码… 例 JJB-8F-3K9Q-2M7X」）+ .caret；`.code-parse`「解析」按钮；解析成功 .parse-ok「解析成功 · v4」
- 解析成功（statusOk）→ `.csum` 摘要（同屏 C 3 场）+ .code-meta（模式/难度总分/来源码）
- 解析失败（statusBad）→ `.toastv.soft`（复用 bp.css）：.toastv-ico「!」+ .toastv-tx（badMsg「对局码无效，请核对后重新粘贴」/「对局码版本不符 · 该码为旧版本，请更新工具后重试」）+ .toastv-rule（badRule「无法开局」/「需更新工具」）
- `.code-actions`：startbtn（statusOk 时可点「按此码开局 ▶」/ 否则 .blocked）+ btn-ghost「返回」+ .spacer + .parse-wait「码方案 · 非实时 · 离线对照」

### 逻辑（DCLogic → React state）
- 屏 C：copied 态（复制后 1.8s 自动复位）；码 = encodePayload(当前局) 的展示形式
- 屏 D：code 输入 + status（null/ok/invalid/version）；doParse = decodePayload(code) 成功→ok+摘要、失败→invalid/version+banner；「按此码开局」= decode 成功后还原 state 进 battle/对照

## 关键文件速查（绝对路径）
- 设计样式真相：/Users/bytedance/项目/jijiebei/web/src/styles/code-scheme.css
- 编码源（选择状态）：/Users/bytedance/项目/jijiebei/web/src/logic/jjbSession.ts + jjbDoubles.ts + jjbView.ts
- 卡片/toast 复用：/Users/bytedance/项目/jijiebei/web/src/components/FactorFrame.tsx + web/src/styles/bp.css（.toastv.soft）
- 真图接法：/Users/bytedance/项目/jijiebei/web/src/lib/designAssets.ts
- P3 调研：/Users/bytedance/项目/jijiebei/docs/research-frontend-p2p3.md
- 编码契约产出（待写，P5 复用）：/Users/bytedance/项目/jijiebei/docs/codec-schema.md

<!-- 集结杯 P1b「BP 规则完整化」spoke 派发契约 — hub 起草(jjb-sediment-r1 workflow)+审核，2026-06-22。
     spoke(新 Claude Code session)第一个工具调用必须 Read 本文件全文，再严格按它执行。规则唯一真相 = projectplan「BP 规则定稿」。 -->

<!-- dispatch_contract:v1 target=claude-session entry=goal -->
<objective>
  把集结杯「BP 规则」从单刷 ban 最小实现补全为完整规则面，落地 jjbSession.ts(规则状态机) + bpConfig.ts(门控键) + SelectScreen.tsx(违规提示 UI)，让比赛模式下的 BP 行为与 projectplan「BP 规则定稿」节逐条对齐，练习模式保持「随意不限制不提示」。

  背景：这是「集结杯 → 比赛平台」P1 的后半 P1b，接 P1a 已落地的 home practice/match tab(HomeScreen.tsx homeMode state，当前纯前端 cosmetic、未下沉到逻辑层)。规则定稿(projectplan「BP 规则定稿」节)要求：练习面随意；规则面违规弹提示不强拦——禁因子玩家任挑1个(含锁定)、禁第2个提示"超出比赛规则"；二选一=禁因子 ⊕ 自选指挥官；自选指挥官单刷三模式锁 2A1B(A弱势≤2/B强力≤1)、双打额外4纯随机池(不卡2A1B)。现状(jjbSession ban runtime)只有 bpBanRuntime 单选 ban(BP_BAN_LIMIT=1、达上限即替换、setSelectedFac 硬挡 banned)，缺：规则面/练习面分流、违规提示(非强拦)语义、2A1B 自选指挥官约束、二选一互斥、双打4纯随机池、bpConfig 的 feiqiu-doubles 键(P0-1 遗留)。

  当前分支 jjb-platform，已完成 P0 架构清场(web/ 自包含、assets/ 冻结)；本任务在 web/src/ 内闭环，零碰 assets/。
</objective>

<scope>
  可以动（allow-list，全部在 web/src/ 内）：
  - web/src/logic/jjbSession.ts —— BP 规则状态机主体。新增/扩展：①规则面 vs 练习面开关(读 P1a home 态或显式 setRuleMode，规则面=enforce-with-toast，练习面=permissive-silent)②违规提示语义(超 ban 上限/违反 2A1B/二选一冲突 → 写 __jjbDebug.select.error/warn 提示文案，不强拦落槽、不阻断 startFromSelection，仅在 validate() 比赛模式下计为 warning)③自选指挥官 2A1B(单刷三模式锁：A 弱势组累计≤2 / B 强力组≤1；组别查 ConfigData.commadnerGroupList 沿用 isGroupB 同款查表)④二选一互斥(同一局 ban 因子 ⊕ 自选指挥官，择一启用；选了一支即提示另一支不可用)⑤双打额外 4 纯随机池(doubles/feiqiu-doubles 走独立 4 池、不受 2A1B 约束)。已有 toggleBanFactor/getBanFor/getBpState/clearBpRuntime/validate/setSelectedFac/setSelectedCmd 沿用扩展，勿重写。
  - web/src/logic/bpConfig.ts —— 仅补 BP_MODE_DEFS 缺的 `feiqiu-doubles` 键(对齐 `doubles`：enabledDefault:false, locked:true，BP 暂未启用)。这是 P0-1 显式键遗留，不改既有 6 键语义。
  - web/src/screens/SelectScreen.tsx —— 接 jjbSession 新透出的规则态/提示字段，渲染违规 toast/红字提示(沿用现有 select error 渲染路径，不新造组件库)。
  - web/src/logic/jjbDoubles.ts —— 仅在「双打 4 纯随机池」需要时只读对接(A档4+B档2=6人指挥官池已存在 cmdPoolSize；feiqiu FEIQIU_ASSIGN_POOL 已存在)。优先在 jjbSession 侧加 doubles-aware 分支，能不改 jjbDoubles 就不改。
  - web/e2e/*.mjs —— 可新增/扩展 e2e 断言覆盖新规则(见 validation)。
  - 对应 .css(如 select 提示样式) —— 仅为新提示态补必要样式。

  不要动（红线，逐条 enumerate）：
  - assets/Script/** —— Cocos/XP 遗产，整树冻结(jjb-dev-loop 红线，git status 须全程空)。
  - assets/resources/** —— 含 jjdata CSV / images / data，整树冻结(web 用 web/src/data 与 web/src/images 副本)。
  - design/** —— 设计稿真相，只读参考不改。
  - web/src/logic/legacy/** —— P0 内联的 3 旧 TS(JijieData/JJConfigData/JJBData)，DEPRECATED 致敬副本，只读 import 不改。
  - 9 模式开局逻辑(startSession/startRandomSession/toStart/toSelect 主干)、点金 goldRuntime、随机敌方、双打真引擎抽取算法 —— 非本任务 scope，不顺手重构。
  - 不自行 git commit / push —— 完工停在工作树交 hub 收口；新文件清单列出待 hub 拍 commit。

  harness round：本任务写 repo + 改行为，**默认开 harness-pro round，planned_phases ≥ 3**(建议拆：P1 规则面/练习面分流+违规提示语义 → P2 2A1B 自选指挥官+二选一互斥 → P3 双打4纯随机池+补 feiqiu-doubles 键+全回归)。少于 3 phase 须说明理由。run.mjs/ui-smoke/r6-doubles/random-enemy 四套作 runVerify 确定性门。
</scope>

<validation>
  done-when（每条可观察、e2e 或 __jjbDebug 断言可证）：
  1. 规则面 vs 练习面分流：练习态下 ban 任意数量因子 / 自选任意数量指挥官均不限制不提示(__jjbDebug 无 error/warn)；比赛态下同样操作触发提示。同一引擎按规则态切换行为，practice=permissive-silent / match=enforce-with-toast。
  2. 违规提示不强拦：比赛态 ban 第 2 个因子 → 提示文案含「超出比赛规则」、但第 1 个 ban 仍有效、不阻断 startFromSelection(操作可继续，仅 warn)；落槽不被静默吞。
  3. 自选指挥官 2A1B：单刷三模式(std8/std10/std12)下自选 A 弱势组累计 ≤2、B 强力组 ≤1；第 3 个 A 或第 2 个 B → 提示违规(规则面)。组别经 ConfigData.commadnerGroupList 查表(A 池混入的 B 组也计，沿用 isGroupB 语义)。
  4. 二选一互斥：同一局 ban 因子与自选指挥官择一——启用 ban 后再自选指挥官(或反向)触发「二选一冲突」提示；__jjbDebug 可读当前启用的是哪一支。
  5. 双打额外 4 纯随机池：doubles 与 feiqiu-doubles 模式下自选走独立 4 纯随机池、**不受 2A1B 约束**(A/B 配额规则在双打不触发)；e2e 验证双打路径 2A1B 不拦。
  6. 补 feiqiu-doubles 键：bpConfig.getBpModeState('feiqiu-doubles')==='locked'(显式键，不再走 fallback)；既有 6 键状态不变。
  7. 零回归：9 模式池=槽恒等式、ui-smoke、r6-doubles-downstream、random-enemy 四套全绿；TS 0 error；assets/ git status 空。

  proof（spoke 必须真实运行并把输出原文贴回）：
  <pre lang="bash">
  cd /Users/bytedance/项目/jijiebei/web && npm run build
  node /Users/bytedance/项目/jijiebei/web/e2e/run.mjs
  node /Users/bytedance/项目/jijiebei/web/e2e/ui-smoke.mjs
  node /Users/bytedance/项目/jijiebei/web/e2e/r6-doubles-downstream.mjs
  node /Users/bytedance/项目/jijiebei/web/e2e/random-enemy.mjs
  # 新规则专项断言（spoke 新增的 e2e，覆盖 done-when 1-6）：
  node /Users/bytedance/项目/jijiebei/web/e2e/<新增 bp-rules e2e 文件>.mjs
  git -C /Users/bytedance/项目/jijiebei status --porcelain assets/   # 须为空
  </pre>
</validation>

<stop_when>
  - 规则定稿与现有 XP 语义冲突无法两全(如 2A1B 的 A/B 组别查表口径与 commadnerGroupList 实际分组不一致、或双打"4纯随机池"具体 4 因子来源在 jjbDoubles 无对应) → 停下，列出冲突点 + 候选解读，交 hub 拍板，不静默选一个。
  - 实现"违规提示不强拦"需要改 9 模式开局主干 / startSession / 双打真引擎抽取算法 → 停(超 scope 红线)。
  - 任一红线目录(assets/** / design/** / legacy/**)出现非空 git diff → 立即停。
  - 四套既有 e2e 任一回归转红且非测试本身过时 → 停下定位，不 --force 推进。
  - P1a home practice/match tab 的态如何下沉到逻辑层无既定接口(当前 homeMode 仅 HomeScreen 本地 state，未经 jjbSession) → 若需新建跨屏规则态通道且设计不明 → 停，提 2 个最简方案(显式 setRuleMode(mode) vs 复用 JijieData 字段)给 hub。
  - harness round 内：reviewer gate BLOCKED 且非假阳性 → 停在 record-gate 前交 hub，不自行 override。
  max_iterations: 不设硬上限(harness phase 自然边界)；每 phase 边界发 ≤10 行小结。
</stop_when>

<context>
  必读(执行前先读全)：
  - /Users/bytedance/项目/jijiebei/projectplan.md —— 搜「BP 规则定稿」(规则唯一真相) + 「集结杯 → 比赛平台 路线图」(P1) + 「P0 架构清场 完成记录」(web/ 自包含 + assets 冻结边界)。
  - /Users/bytedance/项目/jijiebei/web/src/logic/jjbSession.ts —— ban runtime、validate 三规则、setSelectedFac ban 拦截、getSelectState/selfPool/selfShow、isGroupB 查表。
  - /Users/bytedance/项目/jijiebei/web/src/logic/bpConfig.ts —— BP_MODE_DEFS 6 键(缺 feiqiu-doubles)。
  - /Users/bytedance/项目/jijiebei/web/src/screens/SelectScreen.tsx + HomeScreen.tsx —— select error 渲染路径 + home practice/match tab(homeMode)。
  - /Users/bytedance/项目/jijiebei/web/src/logic/jjbDoubles.ts —— A档4+B档2=6人池、FEIQIU_ASSIGN_POOL、variant。
  - jjb-race-rules 记忆 —— 7 模式真相 / 指挥官 A·B 降权 / 胜负判定(交叉印证规则定稿)。
  飞书规则文档若需核对，优先 lark-cli 读 live truth(jjb-race-rules 记忆有链接)，MCP 仅 fallback。
</context>

<motivation>
  集结杯正从「突变随机工具」升级为「比赛平台」(projectplan 当前主线 ★)。BP 规则完整化是 P1 入口分流的规则地基：练习/比赛双模式必须行为可分(练习随意、比赛按规则提示)，否则后续 P2 截图导出 / P3 码方案 / P5 后端积分都建立在不完整的 BP 语义上。规则定稿已由土豆拍板，本任务是把定稿逐条翻译进 web 逻辑层——规则真相在文档与 XP 代码里，设计稿在这些点本就空白，所以先逻辑后视觉、顺序不可倒。

  【六硬约束】①不跳 phase 顺序②review/gate/audit 只许驱动 session 经 CLI 产生，禁手写代跑③frozen 与 runtime 目录只读④禁伪造 PASS⑤证据只引 pre-review 事实⑥不确定/失败/超预算→停下汇报。

  【执行纪律】可逆且 scope 内动作直接做，不"要不要我…"收尾；每条 PASS 对应本 session 真实工具结果，未验证明说未验证，proof 命令真实跑并贴回原文；stop_when 绝对优先于 persistence；交付一次给最终版，最终总结按 validation 列产物路径 + proof 原文 + 新文件清单(待 hub 拍 commit) + 遗留 caveat。
</motivation>

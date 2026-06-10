# 集结杯前端落地 · 完整工作流（开工前对齐 · 2026-06-08）

> 设计真相 = `design/v1/`（==`/tmp/cm-handoff/cm/project/`）。本工作流与「渲染架构&工具分工」画板一致。
> 开发模式见记忆 `dev-workflow-claude-design-to-opus`；构建见 `jijiebei-run-locally`。

## A. 分工（人 / 工具 / 模型）

### A1 人
- **yb** = 前端负责人：经 Claude(hub) 决策、验收、拍板。
- **XP** = 后端逻辑：`jijie2`（JijieData / JJConfigData / JijieControl）规则·状态·随机，手写，**尽量零改**。

### A2 工具（对应渲染 4 层）
| 渲染层 | 工具 | 产出 |
|---|---|---|
| ① 静态整图 | **GPT-image-2** | `bg-main`/`bg-light` 1280×720 无字 + 标题「集结杯」艺术字图 |
| ② 控件 + ④ 文字 骨架 | **Claude Design** | theme/styles/screens/data.jsx = **设计唯一真相**（入 git） |
| ③ 动态图标 | **既有游戏素材** | 指挥官/因子/地图 `images/*` 中文名，**不重画** |
| 组装 | **Cocos / 我(Opus)** | 把设计稿翻成节点树 `jjbDesign/*` |

### A3 执行模型（按"判断密度"分）
- **Claude Code /goal** = 灵活 / 保真敏感：像素对齐(P2)、拖拽手感(P3)、联调(P5)。
- **Codex /goal** = 机械 / 批量：六皮肤 token 套用、样板化、资源批处理(P5)。
- 我(hub) 出 goal prompt + 审 + gate；**会写码/动外部状态的 Codex goal 走 copy-paste**（你过目再粘）。

## B. 治理 — harness-pro（scaffold 全 gitignored）
- 接入：`scaffold-adapter`，**全部 harness 产物 gitignore**（`.claude/`·`.githooks`·`package.json`·`config`·`scripts`·runtime·adapter），XP 仓上游保持干净。
- 每 phase loop：`init → phase → 实现(goal) → runVerify → review → record-gate`；末 phase `stop → audit`。
- **verify（确定性，runVerify）**：build web-mobile exit 0 + TS 0 error + 截图产出 + `__jjbDebug` 数据断言。
- **保真验收（非确定性）**：reviewer + 我看 1280×720 截图 vs HTML 预览（`ui_diff_check`）；偏差须可追溯到「整图未到位(blocked)」或「Cocos 能力限制」，否则回改设计稿。
- 6 硬约束：never skip phases / self-forge review / modify frozen / fake audit / chicken-egg rubric；不确定 → 停下报告。

## C. 边界 — 前端 ↔ XP
- 前端 `jjbDesign/` 读 `JijieData` + 调 `JijieControl`/`InitPanel`（复用 `SelectPanel.checkHit` 拖拽判定、`emit` 触发判定）；改 XP 控制在 0~3 token。
- 注入：`JijieMain.onLoad` 末尾 `tryMount`（唯一 1 行，已落地）。
- 数据：弃用 design 英文 id，统一中文 `name` 拼 `images/{factor,commander,maps}/<中文名>`（资源 100% 命中）。

## D. 每屏开发闭环（phase 内循环）
设计稿(真相) → goal 实现 Cocos 小版本(可运行) → build→serve→1280×720 截图 → vs HTML 预览 diff → **UI 不对回改 Claude Design 设计稿(不手抠 .ts)** → 重新派生 → reviewer + gate。

## E. Phase 计划（5 phase，每个独立 verify/review/gate）
| Phase | 范围 | 工具/执行者 | 验收(verify) | 执行规则 |
|---|---|---|---|---|
| **P1 出图+地基** | GPT-image-2 出 bg×2 + 标题图入 resources；修 JJBView(居中右对齐bug/地图cover/拉丁字体+LabelShadow/fontFamily) | GPT-image-2 + **Claude**(地基保真敏感) | build0+TS0err；3图可载；地基自检截图(右对齐数字/地图不压扁/拉丁字体)；console0err | 只改 jjbDesign/*+加assets；不碰 jijie2 |
| **P2 Home+Overlay 保真** | 接 bg+标题图；按 theme.css **精确坐标**对齐；metal-dark | **Claude**(像素保真) | build0；截图 vs HTML 预览容差内；真bg+标题图+真图标 | 坐标取自 theme.css；UI不对回改设计稿 |
| **P3 选择面板+拖拽** | 槽位+因子池+指挥官分组+开始；**完整拖拽+<30px吸附**(复用checkHit)写回JijieData | **Claude**(手感) | build0；拖因子→吸附；`__jjbDebug` selectedFactorList 写入；截图保真 | 拖拽前端自实现，0改XP |
| **P4 对战+结算** | 对战(3场 win/bonus/lose 三态，emit触发判定)+结算(大比分108px) | **Claude**(判定联调)/结算可Codex | build0；点判定→winCount变；结算读JijieData；截图保真 | 判定 emit 或3 private 提public(≤3token) |
| **P5 联调+6皮肤+清理** | home→select→battle→result 端到端真XP驱动；其余5皮肤token验证；弃用JJBDrawn | **Codex**(六皮肤机械)+**Claude**(联调) | 端到端一局走通(截图序列)；6皮肤截图；JJBDrawn删除；build0+0err | 不新增XP耦合 |

## F. 真相 / 产物位置
- 设计真相：`design/v1/`　前端：`assets/Script/jjbDesign/`　出图落点：`assets/resources/images/{bg,brand}/`
- harness runtime：gitignored　计划：`projectplan.md`(本文件)
- 预览：`localhost:7777/?design=<home|overlay|select|battle|result>&style=<metal|sc2|minimal>&mode=<dark|light>`

## G. 开工前确认（待 yb 拍板）
- [ ] A 分工/工具/模型　- [ ] B harness scaffold 全 gitignore + verify 定义　- [ ] C 边界　- [ ] E phase 顺序与各 phase 验收/执行规则
- 确认后：`scaffold-adapter`(gitignore) → `init --phases 5` → 进 P1。

## P3 执行记录（2026-06-08，goal 任务）

**交付（已完成 + 独立验证）**：`assets/Script/jjbDesign/JJBSelect.ts` 实现选择面板完整拖拽吸附。
- 目标槽改注册式 drop target（透明 hit 热点 + 占位提示）+ 统一 `fillTarget`；active 场 DEMO 预填走同一路径；静态外观与既有高保真渲染保持一致。
- 池子 18 项（因子×6 + A 组×3 + B 组×3 + 自选×6）经 `makeDraggable` 加 `TOUCH_START/MOVE/END/CANCEL`（桌面鼠标 + 移动端皆触发）。
- 吸附判定**只读复用 `jijie2/view/SelectPanel.checkHit`**（世界 AR 坐标 |dx|<30 && |dy|<30）；命中 `fillTarget` 填槽 + 写本地 `selection.slots` + `window.__jjbDebug.select`；未命中 `cc.tween` 回弹。
- **决策**：选择状态留 jjbDesign 本地（DEMO 数据），不写真实 `JijieData`（goal scope 限"只读复用 checkHit、不改 jijie2"；真实联调是 P5）。0 改 jijie2 源码。

**验证**：Cocos build exit 0（21169ms）、console 0 error；运行时 18 draggable；因子→因子槽 / 指挥官→指挥官槽 吸附后 `__jjbDebug.select` 对应槽位赋值（如 slot1={cmds:[阿塔尼斯],factors:[暴风雪]}），超阈值回弹 selection 不变；select/home/overlay 三屏截图结构均不破。

**harness gate（P3）— 已收口（gate=PASS, completed, next=4）**：
- runVerify PASS（build exit 0）→ `review --phase 3` **mode=real、2 真 reviewer（gpt55+gemini-fl）**：14 verdict = **13 PASS + 1 WARNING + 0 FAIL**（真 HMAC 签名）。唯一 WARNING = gpt55 R4（`builder.json startScene`，**P1 baseline 文件**，reviewer 自承 build passed，仅因 evidence 缺 .meta 映射谨慎）。
- **深挖根因（提交隔离后）**：commit 08457dc 把 P1–P2 baseline 入库、隔离 JJBSelect 为唯一 phase-3 diff 后查明：`evidence-bundle-pre-review-3` **不含代码 diff**（真实 key=git_status_raw/verify_report_summary/checksums…），synthesize 起草的 7 条 rubric **全漂到 P1 baseline 文件**、evidence_source 悬空指向不存在的 `#/trace_summary/diff_snippet`。→ **model-review 对 JJBSelect 拖拽实为盲审**（无任何 rubric 实际评到 P3 交付），记为 advisory。这是 direct-dubhe 配置缺口，非 P3 缺陷。
- **P3 真实 gate = 三重确定性验证**：build exit0 + 功能（`__jjbDebug.select` 吸附赋值/越阈回弹断言）+ 视觉（三屏截图不破）。
- **收口（用户选 A「三重验证已足→record-gate」）**：reviewer 数 2<effective_min 3（pareto-k2 配置上限）→ 走 harness 设计内授权出口 `manual-override-phase-3.json`（记 reason/authorized_by/timestamp，gate_check_bypassed=true）→ `record-gate --gate-decision PASS`。hub 裁定 gate=PASS 而非 PASS_WITH_WARNINGS：唯一 WARNING 评的是 P1 baseline 文件、属盲审 noise、不在 P3 scope。**reviewer 真 verdict 文件与真签名原封不动**（R4 在 phase3-gpt55-reviewer.json 仍记 WARNING，永久可审计）；**未 forge verdict/签名、未改 frozen、未 fake audit、未 --force 盲推**。
- **后续 model-review 路线（用户选 A 搁置）**：评 P4/P5 时 model-review 同样盲审；如需真代码审查再投入 claude-code-host（reviewer 读仓）或给 evidence 注入真 git diff。当前 P4/P5 沿用「三重确定性验证 + model-review advisory」。

## P4 执行记录（2026-06-08，goal 任务，停在 gate 前交 hub）

**交付（完成 + 三重确定性验证）**：对战页 `JJBBattle.ts` + 结算页 `JJBResult.ts`，0 改 jijie2 源码。
- `JJBBattle.ts`：3 场 match 行（match-no+双打标 / 地图横幅+名 / 指挥官 / 因子 / Verdict 三按钮）。点 Verdict → 写 `JijieData.winLoseList[i]`(0失败/1胜利/2带奖励) → 重算 `winCount(值1计数)/winbCount(值2计数)/totalCount` → 重绘 active 高亮 → 写 `__jjbDebug.battle`。按钮 `JJBView.hit`(MOUSE_UP)，命名 `jjbV_{场}_{值}`。
- `JJBResult.ts`：banner(kicker + rs-num 108px Oswald 大比分 + /3场获胜 + 完美通关|本局战绩) + 3 战绩卡(按 winLoseList 配色 badge)。大比分=`winCount+winbCount`。
- `JJBData.ts`：DEMO_MATCHES 加 `result`(win/bonus/win) + `VERDICTS/RESULT_LABEL/RESULT_VAL/VAL_RESULT` 常量。`JJBDesignBoot.ts`：加 battle/result 路由+import。
- **语义注记**：winCount 按 goal 显式定义=值1(仅胜利)计数；游戏 `jijie2/LMatchItem` 的 winCount 含 bonus(bonus 路径 winCount++;winbCount++)。P4 取 goal 定义(获胜场数=winCount+winbCount 不双计)，**P5 真实联调需对齐此差异**。

**三重确定性验证（真 gate）**：
- build exit0(23124ms)、console0；新文件 .meta 构建自动生成。
- 功能（Playwright emit MOUSE_UP 断言）：初始 `[1,2,1]` winCount2/winbCount1/totalCount3 → 点 match1 胜利 `[1,1,1]` winCount3/winbCount0 → 点 match0 带奖励 `[2,1,1]` winLoseList[0]=2/winbCount1（**精确命中 goal done-when 示例**）→ 点 match2 失败 `[2,1,0]` winCount1/winbCount1。Result `__jjbDebug.result` wins=3。
- 视觉：battle(三态高亮全showcase)/result(大比分3完美通关)/home/overlay/select **五屏截图结构均不破**。

**harness（停在 gate 前，交 hub 收口）**：phase 4 → runVerify **PASS**(build exit0) → synthesize 7 条 rubric（**正确 scope 到 P4**：RESULT_VAL/VAL_RESULT/VERDICTS 一致性 + DEMO result + 路由守卫；per-phase commit 隔离 diff 生效，无 P3 那种 baseline drift）→ `review --phase 4` **gate=PASS（mode=real，2 真 reviewer gpt55+gemini-fl，7/7 rubric 全 PASS 一致，真 HMAC 签名 req=chatcmpl-a90c54bf/0af3769a）**。evidence_source 仍悬空(同 P3 结构缺口，model-review 仍 advisory)。**未 record-gate / 未 --force / 未伪造签名**——交 hub 收口。

**hub 收口（2026-06-08）**：独立完成代码核对（逻辑/边界/additive，git 实证 0 改 jijie2）+ build exit0 + browser-use 亲验 battle(三态高亮全展示)/result(大比分3·完美通关·战绩卡配色) 两屏高保真(五屏不破) + 验算 spoke 功能断言数值自洽 → `manual-override-phase-4.json`(reviewer 数 2<3 系 pareto-k2 配置上限) → `record-gate --gate-decision PASS` → status=completed, **next=5**。reviewer 真签名/verdict 未碰；未 forge/fake audit/--force。per-phase commit 入库。

## P5 执行记录（2026-06-08，goal 任务，末 phase，停在 gate 前交 hub）

**调研结论（停报红线已解除，方案 A 成立，0 改 jijie2）**：
- **`selectedFactorList`/`selectedCommanderList` 是 XP TS 代码中的 vestigial 死数组**：全仓只在 `toSelect()` `push(null)` 初始化、`initStart()` `=[]`，**无任何地方读取或写入真实值**（grep 实证）。XP 真实数据路径走 LMatchItem 节点属性（`fct.factorName`/`spCommander.cname`），与这两个数组无关。→ jjbDesign 写入它们**不可能损坏 XP 结构**（无 XP 读取；jjbDesign 自建节点树不跑 XP SelectPanel/LMatchItem）。index 语义只需 jjbDesign 自洽：每场 1 指挥官→`selectedCommanderList[场idx]`、每场 3 因子槽→`selectedFactorList[场idx*3+槽idx]`（扁平 9 格）。**select 真实联调无需降级。**
- **winCount 语义（XP 权威，修正 P4）**：XP `LMatchItem.onWinClick`=`winCount++;totalCount++`；`onWinbClick`=`winCount++;winbCount++;totalCount++`；`onLoseClick`=`totalCount++`。即 **winCount 已含带奖励胜=总获胜场数**，`showResultEnd` 直接显示 `winCount`。P4 当时用「winCount=仅胜利、result=winCount+winbCount」与 XP 不符 → P5 修正为 battle 按 XP 累加、result 直接读 winCount。
- `JijieControl.show()`（含 `initStart()` status=0）在 `tryMount` 之前跑 → 直接 URL 旗标 status=0=非 live → 走 DEMO（六皮肤截图零风险，DEMO 路径 byte 不变）。
- `JJLog.writeLog/writeMatchLog` 全注释=no-op → 调 `showResultEnd()` 安全（只写隐藏 jjUI label）。

**实现（方案 A：jjbDesign 自驱读写 public static + 调 public 方法）**：
- `JJBData.ts`：加 `jjbLive()`(status>=2 且 mapList>=3)、`sessionMatches()`(真实 JijieData→屏用 match VM)、扁平因子布局 helper；DEMO_* 保留作 standalone fallback。
- `JJBSelect.ts`：live 时渲染真实 mapList/lockFactorList/随机池(randomFactorPoor/randomCommanderPoorA/B)，`fillTarget` 同时写真实 `selectedCommanderList[slot]`/`selectedFactorList[flatIdx]`，预填+「比赛开始」`onStart` 导航 battle；DEMO 路径不变。
- `JJBBattle.ts`：`recompute` 改 XP 语义(winCount=v∈{1,2}计数, winbCount=v===2, totalCount=已判定)，`totalCount>=3` 调 `JijieControl.showResultEnd()`+`onDone` 导航 result；live 渲染真实 match。
- `JJBResult.ts`：`wins=JijieData.winCount`(不再 +winbCount)；live 渲染真实战绩卡。
- `JJBDesignBoot.ts`：`goSelect/goBattle/goResult` 导航；`onMode` 后 `status<2` 补 `toSelect()` 再进 select；移除 `JJBDrawn` import/`showDrawn`；home/select 热区命名(`jjbMode_i`/`jjbStart`)便于自动化。
- 删除 `JJBDrawn.ts`(+.meta)。

**验证**：见末尾补充（build / 端到端 __jjbDebug 数值 / 六皮肤 / runVerify / review）。

**P5 验证结果（spoke 实测）**：
- **build**：Cocos web-mobile exit 0（21288ms 手测 + runVerify 20531ms），TS 0 编译错误，console 0 error（首次 2 error 系浏览器缓存旧 index.html 的 settings.js hash，cache-buster 后消失）。
- **端到端（URL 旗标，同会话不刷新，Playwright emit + 读 __jjbDebug）**：home 点 jjbMode_1(10因子) → XP onClick3+toStart+(补)toSelect → status=2、真实随机 maps=[升格之链/机会渺茫/往日神庙]、lockFactors=[坚强意志/光子过载/自毁程序]、真实随机池 → goSelect(live) 写真实 **selectedCommanderList=[斯图科夫,扎加拉,菲尼克斯]**、**selectedFactorList=9项真实因子** → jjbStart → battle(live, 记分全0) → 判定 match0胜利[1]→winCount1/winbCount0/total1、match1带奖励[1,2]→winCount2/winbCount1/total2、match2失败[1,2,0]→winCount2/winbCount1/**total3 自动 showResultEnd+导航** → result **wins=2（=winCount，非 winCount+winbCount=3，P5 双计修正得证）**。
- **六皮肤**：home(minimal-dark)/overlay(sc2-light)/select(metal-light DEMO + metal-dark live真实地图)/battle(sc2-dark+minimal-light+metal-dark live)/result(sc2-light DEMO·3完美通关 + metal-dark live·2/3) 截图，6皮肤全覆盖、5屏全覆盖，token 切换结构一致仅视觉变，DEMO 路径不破、live 真实数据渲染。
- **JJBDrawn**：已删（.ts+.meta），全仓 0 残留引用，build 仍 exit0。
- **0 改 jijie2**：git status 实证改动仅 jjbDesign/6文件 + 删 JJBDrawn + projectplan.md，无任何 jijie2/ 改动。独立只读 subagent 复审 4 维度全 PASS（0改jijie2/XP语义等价/DEMO不破/无孤儿）。

**harness（停在 gate 前，交 hub）**：phase5 → runVerify **PASS**(build exit0) → synthesize 7 rubric(glm-5.1) → `review --phase 5` **gate=BLOCKED（mode=real，2 真 reviewer gpt55+gemini-fl）：6/7 PASS 一致，R2 双 BLOCK**。
- **R2 BLOCK = 假阳性（evidence-bundle diff 截断 artifact，非代码缺陷）**：R2 rubric 断言「JJBHome 把 m.name 改成 m.na」。根因——`evidence-bundle-pre-review-5.json` 的 diff_snippet 把行 `...m.no, m.name, m.tag, i, ...` **截断成 `...m.no, m.na`**（gemini-fl verdict 原文明指"truncated line `m.no, m.na`"）；synthesize 据截断幻觉出 R2，两 reviewer 忠实按此虚假前提判 BLOCK。**实证反驳**：git diff 显示 JJBHome 第43行仍 `m.name`（仅插入 `i` 参数 + 热区命名）、全文无 `m.na`、MODES 每项有 name 字段、build exit0、home 六皮肤截图渲染全部模式名。
- **未 record-gate / 未 --force / 未写 manual-override / 未伪造签名** —— 交 hub 收口。reviewer 真签名/verdict 原封（req=chatcmpl-ab1ef079 / chatcmpl-0500761e）。
- **建议 hub**：R2 系 evidence 截断假阳性（同 P3/P4 evidence_source 结构缺口家族）。可选 (a) 修 evidence 生成的 diff 截断后重 synthesize+review；(b) 编辑 R2 DRAFT rubric 对齐真实代码后重 review；(c) 走 P3/P4 同款 documented override（理由=R2 假阳性，附本节实证）。三重确定性验证（build0+端到端真实数据流+六皮肤截图）已足证 P5 交付正确。

## 方向重估与决策（2026-06-09 · workflow 全局诊断后）

**workflow `jjb-planning-review`**（6 维并行调研 + live 复核，完整报告见 task output `wdbr1ai1n`）揭示：原 5-phase 是「界面复刻 + URL 旗标预览」，但**真实目标**是「把已实现的集结杯新 UI + 单刷引擎从旗标预览态切换为线上默认生产入口；并决策双打套新 UI 还是维持回归杯」。

**两条线割裂**：
- XP 线（线上已部署）：古法 UI，单刷规则完整✅，双打仍跑回归杯老引擎（官突+n 0 实现）❌，`title=huiguibei`。
- jjbDesign 新线（已实现未上线）：6 皮肤完整，被 `JJBDesignBoot.ts:25` 一行 `if(!q["design"])return` 门控，线上 0 可见。

**三大 gap**：① 设计（皮肤专属视觉 metal切角/sc2刻线 Cocos 未还原=最大债；背景实景图已落地；亮色 logo/大比分次要）② 规则（单刷 XP 已实现；双打官突+n 设计完代码 0 行；数据 bug 虚空重生者缺分值列；官突 ABC 口径 56A/81B/11C vs 56A/60B/33C 不一致）③ 合流（cutover 根本没在原计划，grep 0 命中；去 `JJBDesignBoot.ts:25` 一行=单刷默认接管；双打无新 UI 路径=独立大工程；部署在 XP 手上）。

**风险**：reviewer 全程盲审（evidence 缺真 diff）不能当上线许可；近零改 XP 与改规则/校数据的张力；`getJijieFactor` while-true 拒绝采样对配置敏感易死循环；CM↔jijiebei 无数据对接靠人工搬运。

**yb 决策**：路线 **C 暂不上线，先精修+校准**（不 cutover，先打质量地基）。并行启动 4 件（均不依赖 XP）：
1. **P5 收口+真代码审查**：真代码审查=invoke read-only subagent 读仓逐行审 jjbDesign 未提交 diff（修 harness 盲审）；审完改 must-fix → 提交 8 .ts+删 JJBDrawn；全模式（极难/拯救/随机）真机回归待排。
2. **设计精修回 Claude Design**：hub 产出 prompt → yb 出 v2（亮色 logo/标题、大比分换算、皮肤专属视觉几何规格、边框、背景方向确认）。
3. **数据校准**：hub 改 `因子配置.txt:30` 回填虚空重生者分值列 + 单测防 while-true 死循环。
4. **官突 ABC 口径统一**：invoke read-only subagent 核对 CSV 输出统一表（落双打代码前置）。

**P5 收口（2026-06-09 · 真代码审查 = 修 harness 盲审）**：read-only subagent 逐行审 P5 未提交 diff + 通读 jjbDesign/jijie2 边界 → **🔴 0 must-fix bug**；🟡 Y1（tryMount catch-all，cutover 强制前置）+ Y2（selectedFactorList 稀疏数组，vestigial 无害不阻塞）；🟢 G1-G10 全 PASS（winCount 对齐 LMatchItem 权威 / jijie2 0改 git 实证 / onMode 各模式恰好 toSelect 一次 / JJBDrawn 删除 0 残留 / showResultEnd+JJLog 安全 / 稀疏 winLoseList filter 幂等 / 异步 cc.isValid 守护 / 事件无泄漏 / live-standalone 三屏一致双防护）。**总评 P5 可安全提交**。全模式真机回归（极难/拯救/随机）代码层已静态确证（G3），动态回归留 cutover 前。

**待启动（地基好 + 和 XP 对齐部署窗口后）**：单刷 cutover（去 `JJBDesignBoot.ts:25` 旗标默认接管 + 改 title=集结杯 + 清场景旧文本 + 全模式回归）——🔴 **强制前置 Y1**：删旗标的同一 PR 必须给 `JJBDesignBoot.tryMount` 的 catch-all（行36-38，现仅 `cc.warn` 吞异常）加可见降级/上报 + 挂载失败回落老 jjUI 兜底，否则 cutover 后任何挂载异常=直播开赛黑屏静默无报错（真代码审查 Y1）；双打官突+n 引擎（独立 ≥3 phase 立项）；XP 重 build+重部署。

## v2 落地 + 风格整改完成（2026-06-09 · 最大设计债清偿）

**v2 Claude Design handoff 落地**（commit 78de115）：6 套标题图按皮肤×明暗重出（PIL 衬线/黑体+渐变）、亮色 logo（logo-cm-*-light）、去旗标默认接管（`JJBDesignBoot` 改 `q["design"]==="off"` 才退出 + Y1 catch 加 cc.error+jjUI 兜底）、结算战绩卡放大对齐 v2。

**风格整改**（commit d2262ee · 清偿「皮肤专属视觉 Cocos 未还原」最大债）：
- `JJBView.bg` 弃写实大图 → 程序化（18段渐变 + sc2 44px网格/metal 118°斜纹 + 顶部光晕 + 暗角）；新增 **overscan 纯色底** 盖住宽屏 canvas 在 1280×720 之外露出的 XP 原场景写实背景
- `JJBView.panel` 卡片 helper（metal 切角12 / sc2 四角L刻线 / minimal 直角）；5 屏卡片（Home 模式按钮/Battle 场卡/Result 战绩卡/Select 场卡/Overlay 场卡）统一用 panel

**验证真相纠偏**：之前反复「卡 Cocos splash」= **browser-use 自身 WebGL 渲染/截图故障**（截不出 canvas 实时帧，多次返回 byte 完全相同的 splash 缓存帧），**非代码问题**。换 **Playwright** 铁证：scene=danshua、JJBDesignRoot **84 节点立即渲染**、**0 errors**、背景 **0 全屏 Sprite（前18节点=1280×41渐变段 + 3个1280×720 网格/光晕/暗角，纯 Graphics）**、卡片四角刻线渲染、宽屏露边盖住、`__jjbDebug.select.live:true`（真实抽取 菲尼克斯/斯图科夫/阿塔尼斯+因子已接入）。sc2 **dark+light 双模式**均与 design #17/#18 一致；金属 logo + 绿/深绿标题质感到位。

**剩余（地基续）**：① light 标题色微调（sc2-light 目标 #123a26，当前≈#1a5c3a 已贴近，可选）② 端到端点击实测（select 抽取→battle 三场判定→result 大比分，验「分配因子」手感）③ 数据 PR（fix/jjdata-factor-score-backfill 待 XP 给 derivative2002 写权限 → push+gh pr create）④ design/v2 稿入库 ⑤ cutover 动态回归（删旗标已做，全模式真机+OBS 16:9 回归留部署窗口）。

## v3 精修完成（2026-06-09 · 完整 handoff 逐项复刻 + 三强化 + select 填满）

design **v3 完整 handoff**（28MB tar.gz：README/chat1.md/theme.css/styles.css/screens.jsx/spec.jsx/data.jsx/assets，handoff URL 触发 tar.gz 下载而非网页）已解压入库 `design/v3/`。据此逐项复刻（commit `bf9e0e3` 代码 + `29fe3c6` 入库）。

**三强化（用户反馈：Logo 金色 / 联名明显 / 字体容器更大）**：
- **全金 logo**：`JJBData.MARK` dark 三皮肤统一 `logo-cm-gold`（light 仍各自深色版保白底可读）。
- **联名放大**：`JJBHome` lockup logo 88→100 / 标题 72→84 / 竖线 64→74 / en 13→16（超 v3 lg）；mode-btn 88→**104** / no 33 / name 25；页边距 50→38。
- **容器字大**：Battle factor 50→56、Result rcard 96→104、Overlay 大比分 46→58。

**select 布局空白修复**（用户截图问题：真实会话下半大白）：`JJBSelect` 三场槽放大（slotH 222→300，地图/指挥官/因子放大）+ 池区放大（factor/指挥官 66→74）+ live 自选空区换「从 A/B 组拖拽」提示 + 比赛开始 live 上移 596（消除孤立空白）+ topbar 页边距 38。

**背景**：`JJBView.bg` sc2 网格 alpha 15/20→13/15（5%）+ 椭圆 Mask 遮罩（中心实四周淡，对齐 design radial mask）；metal 斜纹确认 28° from vertical = CSS 118°（注释修正，dx 不变）。

**验证手法纠偏**：Playwright `page.screenshot` 对 Cocos WebGL 持续 rAF **超时**（等不到稳定帧）→ 改 **CDP `Page.captureScreenshot` return base64**（超限自动存 tool-results 文件 → python 正则提 `/9j/` 解码 jpg → Read）。sc2-dark home（金logo+放大lockup+mode-btn 104 实测）+ select live（填满）+ 端到端（home→select→battle→3判定→result，winCount=2 含带奖励不双计）；**0 errors**，椭圆 Mask 节点正常渲染。

**剩余**：metal/minimal×light + battle/result/overlay 逐屏截图（token 驱动逻辑同，未逐一）；home 6 卡到页脚留白（有页脚锚底，非孤立，未调）；`?design=home` 在 danshua 下点模式进 select 后 URL 不变（正常单页导航，非 bug）。

---

## 本轮（v3 范本忠实复刻 + runtime 主题切换 + 占位虚线）

**根因纠偏（用户 #25/#26）**：此前 select 是手算估值 → A/B 组做成纵向堆叠、删了 18 格自选、占位框实线。用户要求「按 claude design 范本，从 HTML 读精确布局值」。

**① select 按 design 真实结构整体重做**（`JJBSelect.ts`）：读 `design/v3/project/theme.css` 精确 flex 值 — `.slots` grid3 列 → 每 slot（head + mapthumb aspect 475:85 + t-cmds 56×67 + t-facs 56×56 wrap）；`.pool` 横向（左 `.pool-factors` 固定 340 / 右 `.pool-cmd`：`.grp-row` **A 组+B 组横排** + `.grp-self` **18 格 avatar-grid 60×72 9列×2行**）；startbtn 右下。逻辑（targets/fillTarget/makeDraggable/updateDebug）保留。

**② runtime 主题切换器**（`JJBDesignBoot.ts`）：canvas 级常驻 `jjbSwitcher`（3 风格×2 模式按钮，当前高亮）→ 点击 `applyTheme` 重渲当前屏（`reRenderCurrent`，JijieData 真实数据保留）。**置顶保活修复**：gameplay 导航 `fresh()` 新建 root 会盖住切换器 → 在 `fresh()` 末尾把已存在切换器 `setSiblingIndex` 重新置顶（实测 switcherIdx 4 > rootIdx 3）。

**③ 占位框 dashed 化**（用户 #26 箭头指 `Style dashed #56cf8c66`）：`JJBView.dashBox`（Graphics 2.4 无原生虚线 → 沿四边手画 dash 段）+ `JJBTheme` 补 `dropBg` 淡填充 token（6 套 design 精确值，drop-edge 已有）；select 三处空占位（t-cmd/t-fac/18 格）实线 box → dashBox（dropBg 填充 + dropEdge 虚线）。

**XP 解耦确认**（用户提醒）：jijie2 **零 working 改动**；唯一触点 = `JijieMain.ts` 2 行（import + `JJBDesignBoot.tryMount(this.node)`，line 39 注释），置于 XP 逻辑就绪后、try/catch 包裹失败回落老 UI。新代码全在独立 `jjbDesign/`，只读 JijieData public + 调 XP 现成 handler。

**验证**（CDP 截图 + node 断言）：select metal-dark/sc2-dark 结构对（A/B 横排+18 格+地图比例+无重叠）；切换器 home metal→light、select metal→sc2 runtime 重渲对，导航后仍置顶；dashed 占位 sc2-dark 实测绿虚线+淡填充对上 #26；端到端 home→select(live 真实抽取)→battle(3 场真实数据)→3 判定(胜利/带奖励/失败)→result，大比分 **winCount=2 含带奖励不双计**；全程 **0 errors**。改动文件：JJBSelect / JJBDesignBoot / JJBView / JJBTheme（均 jjbDesign，未动 XP）。

## 本轮修复（用户反馈：遮挡/页边距/拖拽/随机）

1. **页边距≈0 根因 = 适配裁边**：Canvas 默认 FIXED_HEIGHT，浏览器/捕获窗口非 16:9 时左右各裁 ~34px，把 design 的 38px 页边距吃成 ~4px。`JJBDesignBoot.tryMount` 改 `cc.view.setDesignResolutionSize(1280,720, SHOW_ALL)`——OBS 浮层固定分辨率应整版完整显示（必要时黑边，bg overscan 顺带填满 letterbox 无黑边）。实测 visible 1211→1280，留白恢复。
2. **切换器遮挡 meta**：右上切换器压住「当前选手」。`buildSwitcher` 起点 bx 936→**610**（各屏 logo 右端 ~463 与右侧 meta 左端 ~1052 的公共空隙，顶部中央），home/select 均不重叠。
3. **拖拽手感**：功能本就正常（实测 A 组拖入第 2 场成功落格 slot1=阿塔尼斯）；`makeDraggable` 加抓取放大 `scale 1.12` pop 反馈 + 回弹复位缩放（grabScale 实测 1.12）。
4. **因子/指挥官固定**：live 已用 XP 随机池（randomFactorPoor/CommanderPoorA/B）；standalone 之前用固定 demo → 加 `shuffle`（Fisher-Yates，运行时 Math.random）洗 FACTORS/GROUP_A/GROUP_B/POOL + active 槽预填也取洗牌后池，反映随机抽取。

验证：home metal-dark + select sc2-light 实测，切换器顶部中央不遮挡、四周留白、拖拽落格 +pop、洗牌每次不同；0 errors。改动仅 JJBDesignBoot/JJBSelect/JJBView/JJBTheme（jjbDesign 内），XP 零改动。

## 本轮修复（用户反馈：亮版标题 + 全金 logo）

1. **亮版「集结杯」标题字重/颜色/高光**（对照 design styles.css 175-186）：之前深字在浅底光学偏细、metal-light 颜色偏暗、缺 design 的白色高光。`design/v2/gen-titles.py` 的 `make()` 加 `bold`（faux-bold：描边同色加粗补字重，metal/minimal→900、sc2→700）+ `hi`（白色 1px 高光下移 2px 垫底，浅底浮雕感，alpha .55/.5/.4）；亮版改 design 精确色（metal 渐变 #8a6516→#2f2105、sc2 实色 #123a26、minimal 实色 #11151c）。暗版配置不变（不回归）。重生成 6 张，仅 3 张亮版 PNG 实际变化。
2. **全金 logo**（用户："所有 logo 都用金色浮雕"）：`JJBData.markFor` 改为所有皮肤×明暗统一返回 `logo-cm-gold`，删除不再用的 `MARK_LIGHT`（连带 metal/sc2/minimal-light 深色 logo 映射）。金色浮雕在三种浅底（minimal/sc2/metal-light）实测均清晰可读（浮雕暗边提供对比）。

验证：minimal-light + sc2-light 首页实测——金 logo 浅底可读、标题加粗有高光、accent 配色正确；0 errors。改动仅 jjbDesign/* + brand 标题 PNG + gen-titles.py，XP 零改动。

## 本轮（用户反馈 #29：槽位预留 + 边框 + 指挥官名字）

1. **槽位提前留空（reserved）**：live 下三场的指挥官/因子槽不再用池子循环无意义预填，全部留 dashed 占位（指挥官/因子 hint），主播从随机池拖拽编排（"选因子"本意）；standalone 仅第 1 场（选择中）预填演示。BOSS 双打 cmdN 改 doubles-aware（live 数据模型单指挥官仍 1 槽，standalone BOSS 2 槽）。
2. **边框（design .factor/.avatar/.filled）**：项目里的 `贴因子用的框架.png` 是斜纹高亮纹理非干净边框，弃用；按 design CSS 实现——新增 `framedCmd`/`framedFactor` helper：池子项黑底 + panelEdge 1px 边框 + 图内缩 1px；fillTarget 填充槽黑底 + **accent 1px 边框**（design .t-cmd.filled）。
3. **指挥官名字小字（design .avatar-name）**：A/B 组池子头像 + 填充到场次槽的指挥官，底部加名字浮层（黑 200α 底 + 10px 白字居中）；18 格自选不加（design name={false}）；因子不加名字。DropTarget 加 `aux[]` 数组管理填充态的底/边框/名字节点（重填一并销毁）。
4. **拖拽层级复位 bug 顺手修**：拖动置顶后回弹只还原位置不还原 siblingIndex → 池子项盖住自身名字浮层。makeDraggable 记录 `homeIdx`，回弹 tween 完成后 `setSiblingIndex(homeIdx)` 复位。

验证（live ?auto=0 sc2-dark）：三场槽位全 reserved dashed；A/B 组带边框+名字；拖 A 组首位→第 1 场成功填充（accent 边框+名字浮层，selectedCommanderList 同步写入）；回弹后池子名字浮层不被盖（root 末位非池子头像）；两次进入洗牌/抽取结果不同（XP 随机正常）；0 errors。XP 零改动。

---

## 全方位调研（2 Explore + dynamic workflow 5 agents，~70万tokens）：XP×jjbDesign×design 三方对账

### 核心真相
1. **"因子不能再选" = 槽位有限 + 开始校验，不是锁池子**。每场槽数动态（LMatchItem.updateStart:91-144 fcount 公式，含每场1锁定因子）：8因子=2/3/3（手选1/2/2）、10因子=3/3/4（手选2/2/3）、12因子=4/4/5名义但 factor4 是幽灵槽（场景 active=False+激活代码注释）实际3/3/3=9。**因子池=手选槽数恒等式**（8因子池5、10因子7、12因子9、随机0）——拖完正好用光。
2. **selectedFactorList/selectedCommanderList 是 vestigial**：XP 全目录零读取（仅声明/清空/push null；容量公式 mfc*3-2 在8因子还差1，随机模式算出-2 也没人在意）。XP 真实数据全在老 UI 组件 LFactorItem.factorName / LCommanderItem.cname。jjbDesign 写入无害但不形成数据桥，唯一读者是自己的 sessionMatches()。
3. **showResultEnd 链路安全**：JJLog 两函数体是注释掉的 AS3 遗留=no-op；writeLog 所需字段（playerName/mfc/modeIsRandom/winCount）新前端全部正确维护。无数据断裂，缺的是规则功能（校验/B≤1）。
4. **老校验三规则**（SelectPanel.onStartClick:238-291）：逐场指挥官非空→活跃因子槽全满→B组≤1（仅 mfc>2 且非 onePick；8因子时"自选"强制计B）。错误红字 txtError，不弹窗。
5. **手选一败终局**：modeIsRandom falsy 时输一场立即 showResultLose；只有随机抽签打满3场。JJBBattle 现在无条件打满3场=静默改赛制。onMode 未设 modeIsRandom=false（首局 undefined 碰巧 falsy）。
6. **随机二分**：标准模式"随机抽签"（JJUI.onRandomClick 自动填充直接 toBattle）在新前端不可达；"随机模式"（onClickSuiji，第6按钮）guard 正确可达。拯救/极难 toStart 自调 toSelect，guard 正确。
7. **design 意图**：factor-sel=已拖入当前场（上浮3px+accent 3px外圈+✓角标）/dim=未选（opacity.4+saturate.55）；选满/取消/锁定因子=设计空白（chat1.md L23 拖拽手感明确推迟）；双打=土豆前瞻预留，XP 无双指挥官（spCommander2 全注释），不冲突。

### 差距矩阵（18条：9 must-fix / 7 should-fix / 1 nice / 1 N-A）
must-fix：GAP-01 槽数动态化(M,是校验前置) / 02 锁定因子显示(S) / 03 开始校验(S,禁按 selectedFactorList null 计数) / 04 B≤1(S) / 06 一败终局+modeIsRandom 防御(S,需土豆确认赛制) / 07 极难16人池横排溢出屏外(S) / 10 自选指挥官机制(M,简化为自选区全量可拖) / 15 主题切换丢状态：battle 清空判定+select 不恢复已选(S) / 16 选手名输入纯装饰 playerName 恒"选手"(M,需 EditBox)。
should-fix：05 selected* 契约固化 / 08 池 sel/dim 反馈 / 09 取消重选 / 11 模式文案错(拯救/极难/随机全显错) / 12 随机抽签入口(需土豆定去留) / 14 六模式端到端+3个未暴露模式(极难②/单指挥官A/非酋)去留 / 17 浮层接真数据+OBS 跨窗口架构。
nice：18 战绩持久化(localStorage 导出，老链路本就为零)。N-A：13 双打。

### 路线（结论：先 XP 逻辑结合，后 Claude Design v4 细化，顺序不可倒）
理由：9 must-fix 全是规则/数据问题且全部可在 jjbDesign 层闭环（XP 零消费 selected*、JJConfigData 可只读 import=无外部依赖）；设计稿在这些点本就空白（规则真相在 XP 代码里，设计师从未拿到，v3 select 屏建立在"每场3因子、无锁定"的错误假设上）；反序会让设计师在同一错误假设上再出一版图。
- 第1批 bug止血(~1天)：GAP-15/06/07/11/05
- 第2批 规则核心(~2天)：GAP-01→02→03→04→16（03 硬依赖 01 槽数表）
- 第3批 玩法补全(~2天)：GAP-10→08→09→14 验收+土豆拍板未暴露模式
- 第4批 回 Claude Design：带着真实规则-界面需求清单（锁定因子样式/校验提示/取消交互/sel-dim 动效/浮层 OBS 形态/随机抽签 UI）申请 v4
待土豆决策：①赛制（一败终局 vs 打满3场）②随机抽签玩法去留 ③极难②/单指挥官A/非酋3模式去留 ④浮层 OBS 采集形态。

---

## 用户决策落地（OBS 调研 + 批1 止血完成）

**决策敲定**：①单刷打满3场（不沿用 XP 一败终局）②随机抽签保留（排批3）③极难暂不上 home（按钮摘除，XP 路径保留，溢出降级）④浮层必须动态 ⑤双打=官突独立新模式（基于官方突变+随机额外因子+预选地图+2人，XP 无此模式，待土豆细节，批4后排期）。

**OBS 调研**（两源交叉：obs-browser GitHub + obsproject kb）：浏览器源=CEF（完整 Web API；`--enable-gpu` 可开硬件加速）；**Interact 交互**为 OBS 标准能力（右键源→交互，弹窗直接操作网页）；另有 Browser Docks。**浮层架构定稿=单窗口**：OBS 浏览器源指向应用 URL（单页面实例零同步），主播经 Interact 操作 select/battle，对局中页面切 overlay 形态（动态+大字版，缩小放底部仍可读→批4 v4 设计核心需求）。待实测：OBS Interact 内 Cocos 拖拽手感、B站直播姬浏览器源交互（兜底=直播姬窗口捕获 Chrome）。

**批1 止血（全部完成+验证）**：
1. battle 切主题不清记分：`JJBBattle` live 仅未初始化才置 `winLoseList=[]`；新局重置上移 onMode。实测判[1,2]切主题 preserved=true。
2. select 切主题恢复已选：`JJBSelect` build 末回读 selected* 调 fillTarget 恢复。实测拖菲尼克斯→切 sc2→slot0 恢复。
3. modeIsRandom=false 防御 + 注释记录"打满3场"赛制；onMode 统一重置 selectedCommanderList=[null×3]/selectedFactorList=[null×9]/winLoseList=[]（9 格契约固化，覆盖 XP mfc*3-2 预填）；JJBData 补"禁按 length/null 计数判选满"红线。实测随机模式 selCmd 3null/selFac len9。
4. home 摘"极难模式"：MODES 5 项（随机编号 05）+ handlers 摘 onClickHard。实测 5 按钮。
5. 三屏模式文案 `modeLabel()`（按 modeSuiji/Zhengjiu/VeryHard/Feiqiu/OnePick flags+modeIsRandom 推导）。实测随机模式显"随机模式 · 抽取"（旧错显"10 因子 · 手选"）。

全程 0 errors。改动：JJBBattle/JJBSelect/JJBDesignBoot/JJBData/JJBResult（均 jjbDesign），XP 零改动。下一步=批2 规则核心（GAP-01 槽数动态化→02 锁定因子→03 开始校验→04 B≤1→16 选手名 EditBox）。

## 批2 规则核心 + 批3 玩法补全（2026-06-10 · goal 任务 · 10 gap 全部完成）

**commit 链**：`250d185` 基线（批1 止血+边框名字+亮版标题）→ `0c7b274` 批2 → `e7518e4` 批3。改动仅 jjbDesign/* + projectplan.md，**jijie2/Scene/jjdata/design 零改动（git diff 实证）**。

### 批2（A1–A5 = GAP-01/02/03/04/16）
- **A1 槽数动态化**：`JJBData.manualSlots(slotIdx)` 纯函数镜像 XP `LMatchItem.updateStart` fcount 规则（手选=min(fcount-1,3)，12因子场3 factor4 幽灵槽不计）。对账表实测一致：8因子=1/2/2、10因子=2/2/3、12因子=3/3/3、拯救=2/2/3、随机=0/0/0。「因子池数=手选槽总数」恒等式（5/7/9）暴露 `__jjbDebug.select.poolIdentity` 交叉断言全 true。9 格 facFlatIdx 契约不变。
- **A2 锁定因子**：select 每场因子行行首渲染 `lockFactorList[i]` 固定格（filled 黑底+accent 边框+「锁定」角标，不可拖不可清除不入 targets）；modeSuiji 整行不显示（对齐 XP updateStart 隐藏 lockFactor）；`sessionMatches()` 透出 `lock` 字段，battle/result 首因子加同款角标。
- **A3 开始校验**：`validate()` 镜像 XP `SelectPanel.onStartClick` 三规则（逐场指挥官非空→逐场手选槽全满[槽数来自 A1 动态表]→B组≤1），不通过 startbtn 左侧 th.lose 红字+不导航，通过清红字导航。错误文案与 XP 同形（"第X场指挥官未选择"/"第X场因子Y未选择"/"B组指挥官只能选1个"）。
- **A4 B组≤1**：name→组别查 `JJConfigData.commanderList`（只读 import，对齐 XP checkBCount 查表语义而非按池子来源）；触发条件精确对齐 XP：`mfc>2 && !modeIsOnePick`，8因子(mfc==2)不终检。
- **A5 选手名**：home「参赛选手」换程序化 `cc.EditBox`（textLabel/placeholderLabel 手工建并指派——编辑器外创建默认为空，失焦后文本会不可见）；输入存 `Boot.playerInput`（主题切换重建恢复）→ onMode 写 `ip.txtName.string`，XP onClickX 自读写 `JijieData.playerName`，零语义漂移。实测输入「测试选手」三屏 topbar 同名。

### 批3（B1–B5 = GAP-10/08/09/12/17）
- **B1 自选指挥官**：live 自选区渲染 commanderList 全量（ban后16）减 A/B/C 池=10 人全可拖（合并 XP「拖自选图标+点选」两步，消灭"没点选→自选.png"宽松漏洞）；显示条件镜像 XP updateSelect（拯救/随机/极难①/非酋无自选区，拯救实测显示"本模式无自选区"+仅 7 个 A 池项）；B 组占用经 groupMap 合并计入 A4。
- **B2 池 sel 反馈**：`refreshPool()` 按 selection 重算——被任何槽使用→上浮3px+accent 2px 外圈+右上✓角标（design .factor-sel），未使用→常态；不做整池 dim。**池子项重构为单容器节点**（黑底+边框+cover 图+名字浮层整体拖动/置顶/上浮，顺带修了拖动时边框名字不跟手的割裂感）。
- **B3 取消重选**：点击已填槽=清空（destroy fill/aux→`drawPlaceholder` 无条件重画 dashed+hint→selection 与 JijieData.selected* 置 null→池 sel 重算）；**350ms 窗口**区分拖拽释放的 mouse/touch 双事件流（释放瞬间槽 hit 也收 MOUSE_UP，不当成清槽点击）；锁定格不入 targets 无此交互。实测清后可重拖。
- **B4 随机抽签**：标准模式（home i=0/1/2，XP toStart 停 status=1）弹「手选阵容/随机抽签」二选层（遮罩挡底层点击；拯救/随机模式 status 已=2 照旧直进）。手选=modeIsRandom false→toSelect→固化 9 格契约→select。随机=调 XP public `jjUI.onRandomClick(null)`（置 modeIsRandom=true+抽3指挥官+全部因子写隐藏老 UI 组件+内部 toBattle 到 status=3）→镜像写回（`spCommander.cname`→selectedCommanderList、active `factorN.factorName`→selectedFactorList 扁平位）→winLoseList=[]→battle。`?path=manual|random` 自动化旗标。实测随机抽签直达 battle、3 指挥官+7 因子（10因子）镜像非空、modeLabel 显「随机」。
  - **已记录 XP 副作用**（不触发 stop：与线上老 UI 行为一致，单局影响=0）：`onRandomClick` 直接 splice `ConfigData.commanderList` 抽走 3 人。本前端单局流程（result 后无"再来一局"入口，刷新开新局）不受影响；**后续加局内重开功能时必须处理此污染**。
- **B5 浮层动态化**：overlay live 接 `sessionMatches()`（已判定→win/bonus/lose 徽章、首个未判定→「进行中」accent 高亮、其余→「待战」；比分=winCount/3，XP 语义含带奖励）；battle 右上「直播浮层」↔ overlay 右下「返回判定」互切（经 Boot，curScreen 同步暴露 `__jjbDebug.screen`，主题切换器照常）。实测判 1 场后 overlay score="1 / 3"、statuses=[win,live,wait]，切回 battle 判定保留。

### B6 验收（三重确定性验证）
- **build**：Cocos web-mobile exit 0，TS 0 错误。
- **端到端（Playwright 8 路径 36/36 断言 PASS，全路径 console 0 errors）**：①8因子手选全流程（槽数1/2/2+锁定+空槽拦截+sel✓+清槽重拖+自选区拖入+判3场[胜/带奖/负]→result wins=2 不双计）②10因子双B拦截→清槽换A放行 ③12因子3/3/3池9 ④拯救直进2/2/3+无自选区 ⑤随机模式0/0/0无因子槽 ⑥随机抽签直达battle+镜像非空+浮层互切 ⑦二选层弹出+手选可达 ⑧EditBox名字三屏流转。
- **对抗审查**：只读 subagent 独立审 diff 对照 XP 真相，9 项声明 **0 必修 BUG**；2 个已记录可接受 RISK（350ms 启发窗口在高延迟设备的理论误伤；PoolItem 坐标 init 快照对动态 resize 脆弱——当前无 resize 场景）。
- **视觉**：CDP 截图 3 屏确认（select live sel 态+自选全量带名 / 二选层 metal 金色切角按钮 / overlay live 真实地图阵容+三态徽章）。
- 测试基建：`/tmp/jjb-test/{helpers,all,shots}.js`（Cocos 节点查找/emit 点击/TOUCH 拖拽/EditBox 注入；注意 `cc.isValid(n, true)` strict 模式才过滤同帧 destroy 节点）。

### 剩余（批4 前置）
- 回 Claude Design 申请 v4：锁定因子样式/校验红字提示/二选层/取消交互动效/浮层 OBS 缩小可读形态/随机抽签 UI 的设计语言（当前全部用 token 兜底先行）。
- 待土豆：极难②/单指挥官A/非酋 3 模式去留（GAP-14 后半）；双打官突独立立项。
- 局内重开（如需要）：处理 onRandomClick splice commanderList 污染。

## XP 线上老版 vs jjbDesign 玩法行为对比（2026-06-10 · Playwright 只读验证）

**范围与证据**：老版 `https://sparkling-scene-a26a.xxpp111.workers.dev/` 1 次加载成功；新版 `http://localhost:7777` 已运行。脚本/证据在 `/tmp/jjb-compare/`，完整矩阵 `/tmp/jjb-compare/comparison-matrix.md`，原始读值 `/tmp/jjb-compare/evidence.json`，截图 `/tmp/jjb-compare/screens/`。未修改 `assets/**`、`design/**`。

**矩阵摘要**：
- home：老版线上 9 按钮（8/10/12、拯救、极难、极难2、单指挥官A、随机、非酋）；新版 5 按钮（8/10/12、拯救、随机）。极难缺失为已知决策；极难2/单指挥官A/非酋属于老版额外入口，待产品确认去留。
- 标准 8：两端均为 3 地图、每场 1 锁定因子、手选/随机二分存在。
- 手选槽/池：8=1/2/2+池5、10=2/2/3+池7、12=3/3/3+池9，两端一致。老版 12 因子 `factor4` 三场均 inactive，是线上老版幽灵槽怪癖。
- 校验：空开始两端均报「第1场指挥官未选择」；10 因子双 B 两端均报「B组指挥官只能选1个」。
- 随机抽签：标准 10 因子两端均自动填满并直达 battle；实测 3 指挥官 + 7 手选因子 + 3 锁定因子。
- 判定/结算：三按钮（胜利/带奖励/失败）存在；胜+带奖励+失败后老版「获胜2场」，新版 `wins=2, winLoseList=[1,2,0]`，带奖励不双计一致。老版手选输首场立即结算、新版继续打满 3 场为已知赛制差异，不记偏差。
- 随机模式：两端 select 均只选指挥官，无因子槽（slots=0/0/0，因子池0）。

**差异分类**：
- 有意差异：新版 5 按钮；新版自选指挥官直接拖全量区（合并老版「拖自选图标+点选」）；新版手选打满 3 场；视觉不纳入。
- 疑似新版偏差：未发现覆盖范围内的玩法偏差。
- 老版怪癖：12 因子 `factor4` 存在但 inactive；老版 home 仍暴露极难2/单指挥官A/非酋等额外入口。

## 双打（官突）模式骨架实施计划（2026-06-10）

**目标**：新增 jjbDesign 自管双打会话，不走 XP `jijie2` 状态机；规则全部收敛到 `DOUBLES_CONFIG`，后续改配置即可调整 matches/maps/mutators/cmdsPerMatch/extraFactors/poolSize/scoring。复用 home → select → battle → result + overlay 四屏展示，不改 XP 领地。

**执行步骤**：
1. 新增 `assets/Script/jjbDesign/JJBDoubles.ts`：定义 `DOUBLES_CONFIG`、静态会话状态、`start/reset/doublesLive/doublesMatches/setCommander/setFactor/clear* / setVerdict / debug`。
2. Home/Boot：`MODES` 增加第 6 个「双打模式 · 官突」；`?doubles=1` 直进双打 select；第 6 按钮走 `JJBDoubles.start()`，不调 XP handler。
3. Select 三分支：`doublesLive() ? doublesMatches() : jjbLive() ? sessionMatches() : DEMO`；双打按配置渲染 matches 个场次、`cmdsPerMatch` 指挥官槽、mutators 官突锁定格、`extraFactors` 额外因子槽、单组指挥官池与因子池；校验为指挥官/额外因子逐槽必填，无 B 组限制。
4. Battle/Result/Overlay 三分支：双打读写 `JJBDoubles.winLoseList`，大比分分母用 `DOUBLES_CONFIG.matches`，双打角标/双头像/多因子自然渲染。
5. 验证：默认配置端到端、配置三连改（matches 1→3、extraFactors 3→5、cmdsPerMatch 2→1）、主题切换不丢状态、单刷 8 因子手选 + 随机抽签回归、Cocos build、`git diff -- assets/Script/jijie2/` 为空。

## 双打（官突）模式骨架完成记录（2026-06-10）

**交付内容**：新增 `assets/Script/jjbDesign/JJBDoubles.ts`，双打会话完全由 jjbDesign 自管；`DOUBLES_CONFIG` 当前默认值为 matches=1、maps=["湮灭快车"]、mutators=["风暴英雄","虚空裂隙"]、cmdsPerMatch=2、extraFactors=3、factorPoolSize=6、cmdPoolSize=8、scoring="per-match"。Home 增加第 6 个「双打模式 · 官突」，`?doubles=1` 直进双打 select；select/battle/result/overlay 均按 `doublesLive() ? doublesMatches() : jjbLive() ? sessionMatches() : DEMO` 新增双打分支，未重排单刷 XP 分支。

**规则与 UI 骨架**：双打 select 按配置渲染场次数、每场指挥官槽数、官突 mutator 锁定格、额外因子槽、因子池和单组指挥官池；开始校验为逐场 `cmdsPerMatch` 个指挥官非空 + `extraFactors` 槽全满，无 B 组限制。battle/result/overlay 读写 `JJBDoubles.winLoseList`，大比分分母取 `DOUBLES_CONFIG.matches`，胜/带奖励/失败仍按单刷三态语义，带奖励不双计。`window.__jjbDebug.doubles` 暴露 config/live/selection/winLoseList。

**验证证据**：Cocos web-mobile build exit 0；Playwright 默认回归 `/tmp/jjb-doubles-default-final.json` 为 21/21 PASS、console errors 全 0，覆盖 `?doubles=1` 双打默认链路、主题切换保留选择/判定、单刷 8 因子手选全流程、10 因子 B≤1、随机抽签直达 battle。配置三连改均已临时改配置、重 build、跑断言后恢复默认：`/tmp/jjb-doubles-config-matches3.json` 8/8 PASS，`/tmp/jjb-doubles-config-extra5.json` 7/7 PASS，`/tmp/jjb-doubles-config-cmd1.json` 7/7 PASS，console errors 均 0。`git diff --stat -- assets/Script/jijie2/ assets/Scene/ assets/resources/jjdata/ design/` 为空。

**占位假设**：双打当前为骨架规则，指挥官池不分 A/B 组；当 matches=3 且 extraFactors=3、factorPoolSize=6 时，测试按“池项可复用拖入多槽”的占位交互验证配置生效。后续产品确定不可复用或玩家/地图细则后，只改 `JJBDoubles.ts` 配置与校验策略即可继续收敛。

---

## 阶段收口（2026-06-10）+ v4 细节修缮 brief

**本阶段成果（commit 链 250d185→e5e776f 共 7 笔）**：批1 止血 → 批2 规则核心（5 gap）→ 批3 玩法补全（5 gap）→ 新旧版本行为对比（零偏差）→ 双打官突骨架（全参数化）→ 双打三轮配置（XP 原型考古实证：非酋模式=双打残骸，spCommander2/6人池/一键随机/指挥官2校验）。单刷收口、双打骨架就绪。

**下一阶段 = v4 细节修缮（设计先行）**：需求 brief 已写 `design/v4-brief.md`，交 Claude Design 出设计后 TS 复刻。核心需求：①因子游戏边框（CM 项目现成素材 border-normal-mutatorframe 普通绿框 / border-gold-grandmaster 金色强化框，语义见 CM/tmp/design-handoff-announce-202606/mutator-reference.md）②指挥官边框（游戏选人界面微圆角+亮光长方形）③全局导航控制条（屏幕回切+重新随机+回主界面，含误触保护）④兜底转正（锁定格/校验红字/二选层/清槽提示/sel 动效）⑤浮层 OBS 底部横条形态（1280×200~240，缩至1/3可读）。

**待确认**：赛事是否启用 CM 金色强化因子（决定金框两态是否需要）；重新随机的 XP 侧实现注意 onRandomClick splice 污染（考古已记录）。

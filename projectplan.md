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

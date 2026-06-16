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

## v4 复刻实施记录（2026-06-11 · Codex spoke）

### Phase A：边框系统基建 + select 落位

**改动**：新增 `assets/Script/jjbDesign/JJBBorder.ts`，封装 v4 因子框、指挥官卡、toast；新增 `JJBData.GOLD_FACTORS`（默认空数组，赛事需要金色强化因子时填名单）；将 `design/v4/input/border-factor-normal.png` 与 `border-factor-gold.png` 入库到 `assets/resources/images/brand/`。`JJBSelect.ts` 的因子池、锁定/官突格、填充槽、指挥官池和校验提示已接入 v4 helper；裸红字替换为右下 toast，保留 `__jjbDebug.select.error`。

**验证**：
- Cocos web-mobile build exit 0。
- 既有 Playwright 8 路径回归 36/36 PASS，console 0 errors：8 因子手选全流程、10 因子 B≤1、12 因子、拯救、随机模式、随机抽签直达 battle、二选层、选手名。
- PhaseA 新断言 4/4 PASS：v4 因子节点存在、指挥官池存在、toast 出现并保留 error 语义、4s 自动消失，console 0 errors。
- 截图留档：`/tmp/jjb-v4-impl/phaseA-select-metal-dark-toast.jpg`。
- `git diff --stat -- assets/Script/jijie2/ assets/Scene/ assets/resources/jjdata/ design/` 为空。

### Phase B：全局控制条 + battle/result/overlay V4 落位

**改动**：`JJBDesignBoot` 将原 `jjbSwitcher` 升级为 v4 全局控制条，包含导航、重新随机/回主界面 armed 确认、主题切换与收起把手；保留置顶保活。重新随机单刷路径不走 `onRandomClick`，按当前模式重抽并停在 select；双打重跑 `JJBDoubles.start()`。`JJBBattle/JJBResult/JJBOverlay` 接入 `JJBBorder`，battle 使用 58×70 指挥官卡、56×56 因子框、70px 判定按钮、进行中徽标和行级 active 包边；result/overlay 同步使用 64×78 指挥官卡与 46/52px 因子框。

**验证**：
- Cocos web-mobile build exit 0。
- 既有 Playwright 8 路径回归 36/36 PASS，console 0 errors。
- 控制条新断言 12/12 PASS：home 禁灰、收起/展开、armed 5s 自动还原、重新随机确认后停 select 且 selected* 重置、池/地图变化、battle→overlay 导航、确认回主后状态重置。
- 截图留档：`/tmp/jjb-v4-impl/phaseB-battle-sc2-dark-v2.jpg`、`phaseB-overlay-sc2-dark.jpg`、`phaseB-doubles-select-metal-dark.jpg`。
- `git diff --stat -- assets/Script/jijie2/ assets/Scene/ assets/resources/jjdata/ design/` 为空。

### Phase C：回归、金框配置、视觉留档

**验证**：
- 金框配置：临时将 `GOLD_FACTORS` 设为 `["暴风雪"]` 后重 build，运行时确认 `暴风雪` 使用 `border-factor-gold`；恢复空数组重 build，确认同项回到 `border-factor-normal`。
- 最终 Playwright 汇总：既有回归 36/36 PASS；Phase A/B/C 额外断言 17/17 PASS；console 0 errors。汇总 JSON：`/tmp/jjb-v4-impl/playwright-summary.json`。
- 视觉留档：6 主题 select+battle 全部 CDP 截图，另存设计 review battle 截图。目录：`/tmp/jjb-v4-impl/`。
- 最终 Cocos web-mobile build exit 0；`git diff --stat -- assets/Script/jijie2/ assets/Scene/ assets/resources/jjdata/ design/` 为空。

**补充修正**：完成审计时补齐 battle 行级态细节：判定后立即重绘行状态（下一场变「进行中」、已判定行降权覆盖），同一判定按钮二次点击可取消回未判定。补充断言 3/3 PASS，既有回归仍 36/36 PASS，console 0 errors。

## v4 Phase D（R2② OBS 底部横条）执行记录（2026-06-12 · Codex spoke）

**交付内容**：新增 `assets/Script/jjbDesign/JJBObsBar.ts`，将 `design/v4-r2` R2②「OBS 底部横条」复刻为 jjbDesign 新屏 `obsbar`。横条为 1280×232，贴 720 舞台底部；顶部 3px accent 发际线；左侧 188px 分数轨（CM logo + 竖线 + 集结杯 + 74px 大比分 + /总场 + 标签 + pip），右侧按 flex 1/1.52/1 渲染三场列。当前进行场 hero 加宽、2px accent 包边、场次号/徽章/指挥官卡/因子框上调；非 live 场指挥官只保头像，已判定场降权。卡片语言在 `obs-match` 等价结构内作用域化复刻 metal 切角 12、sc2 角刻线 13、minimal 圆角 8；地图缩略只显示烤进图内的地图名，不叠二次名牌。

**数据与路由**：`JJBDesignBoot` 增加 `?design=obsbar` 直达、控制条「横条」导航，以及 battle/overlay 一步切横条入口；控制条在 obsbar 屏继续置顶，六主题热切保留当前状态。数据分支与既有屏一致：`doublesLive()→doublesMatches()` / `jjbLive()→sessionMatches()` / `DEMO_MATCHES`。比分 `wins` 只按 win|bonus 判定场计数，bonus 不双计；pip 与 win/bonus/lose/live/wait 同步；全场判定完切终局标签「终局 · 已胜场」。双打 `?design=obsbar&doubles=1` 按 `DOUBLES_CONFIG.matches` 渲染场数与分母，并显示双打标。因子框复用 v4 border helper 同源资源，`GOLD_FACTORS` 在横条中同样走 gold/normal 分支。

**动效**：进行中徽章点与 live pip 使用 `cc.tween` 1.1s 循环脉冲；判定徽章落定 140ms；hero 迁移强调 220ms；pip 翻入 120ms；横条入场 240ms。未新增任何图片资源。

**验证证据**：
- Cocos web-mobile build exit 0，最终用时 10s；TS 编译 0 错误。
- 既有回归 `/tmp/jjb-test/all.js`：36/36 PASS，console errors `M8:0 M10:0 M12:0 ZJ:0 SJ:0 RND:0 CHOICE:0 NAME:0`。
- v4 既有断言回放 `/tmp/jjb-test/v4-existing.js`：20/20 PASS（17+3），console errors `phaseA:0 ctrlHome:0 ctrlSelect:0 ctrlNav:0 row:0`。
- 新增 R2② 断言 `/tmp/jjb-test/obsbar.js`：19/19 PASS，console errors `direct:0 live:0 nav:0 doubles:0`，覆盖结构存在性、五态展示、单源同步、双打、hero 加宽与包边、GOLD_FACTORS 运行时生效、33% 尺寸无溢出。
- 视觉留档 `/tmp/jjb-v4-impl/`：`obsbar-metal-dark.jpg`、`obsbar-metal-light.jpg`、`obsbar-sc2-dark.jpg`、`obsbar-sc2-light.jpg`、`obsbar-minimal-dark.jpg`、`obsbar-minimal-light.jpg`、`obsbar-scale-33-sc2-dark.jpg`（426×77）、`obsbar-final-sc2-dark.jpg`。
- 红线审计：`git diff --stat -- assets/Script/jijie2/ assets/Scene/ assets/resources/jjdata/ design/` 为空。

**遗留说明**：OBS 透明背景未作为 Cocos 层强承诺处理；obsbar 自身始终有主题底色，自动化与截图按底部横条区域裁切验证。33% 可读性的最终审美裁定留 hub/人工验收，本次 spoke 已完成无溢出断言与截图留档。

## v4 Phase D-fix（2026-06-12 · R2② 验收修复 · 自主长跑）

**触发**：hub 验收发现 R2② obsbar 工作树未提交代码存在 4 类 must-fix（整页破相 / 字色硬编码 / 徽章越卡片 6px / 断言水分）+ B 组 should-fix 与微调包；上一轮 spoke 因「裁切截图 + 自报常量断言」漏掉整页破相，本轮验证纪律（渲染实测 + 全页留档）作为修复同等重要的一环。

**A 组 must-fix（A1–A4）**：
- **A1 全屏背景**：`JJBObsBar.build` 首行 `JJBView.bg(root, th)` 盖 XP 老场景；6 主题全页截图实测无 XP 写实背景透出。JJBView.bg 同步埋 `__jjbDebug.__jjbFullscreenBgNode = true` 标记供断言实测。
- **A2 JJBTheme 加 onState token**：6 主题精确值源 `design/v4-r2/styles.css` —— metal-dark #0b1206 / metal-light #ffffff / sc2-dark #062013 / sc2-light #ffffff / minimal-dark #04101f / minimal-light #ffffff；obsbar 徽章 win/bonus 字色改 `th.onState` 替代 `ON_STATE` 硬编码（JJBBattle/JJBResult 的同款硬编码属冻结遗留，不动）。
- **A3 徽章按实宽右对齐**：`x + w - RIGHT_INNER_PAD - badgeW`（13 像素右内缘 + 实宽计算），实测 `badgesRightAligned = true`（3/3 徽章 delta=0 包围盒实测），消除「带奖励」徽章越卡片 6px 破相。
- **A4 断言去水分**：`exposeDebug` 改实测 —— 遍历 `jjbObsBar` 子节点用 `convertToWorldSpaceAR` 拿世界 Y-up 包围盒校验不越 1280×232（容忍 ≤1.5px 渐变段重叠），bar 节点 br.y 实测（应等于 -360 Y-up 世界底）；删除 `topAccentPx=3` / `themeEdgeExplicit=6` 两个自报常量；`/tmp/jjb-test/obsbar.js` 同步改断实测值（6 主题全页截图存盘 + bg 节点存在断言 + brY=-360 断言 + 徽章 delta=0 断言 + 越界 chips 回报）。

**B 组 should-fix + 微调包（B1–B6）**：
- **B1 已判定列整列降权**：done 列的 panel.opacity=220 + 4 个子节点（badge / map / cmdCard / factorCard）也 opacity=220；地图叠暗色近似降饱和（设计稿要 `saturate(.55)`，Cocos 2.4 无内建 saturate，注释说明改用 opacity 0.6 近似降饱和的取舍）。
- **B2 字体调整**：大比分 / 场次号 / scoreLabel / 集结杯标题去 Oswald 改系统中文（移除 FONT_NUM / `th.serifTitle ? ""` 的 no-op）；metal 衬线三处（title + scoreLabel + 双打标用 Songti SC, STSong, serif）；加粗走 LabelOutline（同 JJBObsBar.ts:157 集结杯已有手法）。
- **B3 「/总场」拆两个 Label**：「/」用 muted、总场用 th.ink，x 紧贴大比分实宽（74px 数字单字符 ≈ 0.6*74=44px，加 9px 视觉间隙，不再固定 +82）。
- **B4 factorTag 复用**：JJBBorder.factorTag 改 public（factorTag 左下角与 ① 一致），JJBObsBar.factorCard 删除自绘左上角 tag，isMutator=true 时调 JJBBorder.factorTag(n, "官突", th, false)。
- **B5 大比分入场动效 + 判定 backOut**：大比分 Label scaleY 0.25→1 quadOut 120ms（与 pip 同手法）；判定徽章 easing 改 backOut（1.04→1 弹回手感更稳）。
- **B6 微调包**：pip top 200→208；因子块在阵容行垂直居中（factorOffsetY = (lineH - factorBlockH)/2）；折行行距 7→8（factorLineGap）；hero 列地图 top 43→49（live 加 hero 下沉让出 badge 行高）；logo 等比（高 30 宽 auto，新 logoSized helper 按原图比缩放）；移除设计中不存在的 18px 暗角；清理死代码（onBack 形参、hit() helper、cmdCount 变量、`Boot.goObsBar` 不传死回调 `() => goBattle()`）。

**验证证据**：
- **build**：`'/Applications/Cocos/Creator/2.4.13/CocosCreator.app/Contents/MacOS/CocosCreator' --path . --build 'platform=web-mobile;debug=true'` exit 0（≈12s），TS 0 编译错误，console 0 error。
- **obsbar.js 33/33 PASS**（consoleErrors 0）：fullpage-6themes + bg + bottomAligned(brY=-360实测) + noOverflow实测 + badgesRightAligned(3/3 delta=0实测) + 1280x232 + scale033 + 五态 + hero + GOLD_FACTORS + 单源同步(win/bonus/final) + overlay 切 + doubles 全部 PASS。
- **all.js 36/36 PASS**（consoleErrors 0：M8:0 M10:0 M12:0 ZJ:0 SJ:0 RND:0 CHOICE:0 NAME:0）。
- **v4-existing.js 20/20 PASS**（phaseA:0 ctrlHome:0 ctrlSelect:0 ctrlNav:0 row:0）。
- **视觉留档 `/tmp/jjb-v4-impl/`**：
  - 6 主题全页：`obsbar-fullpage-{metal,sc2,minimal}-{dark,light}.png`（1280×720，bg 节点实测 + 全页人眼可核无 XP 写实背景）
  - 6 主题横条裁切：`obsbar-crop-{metal,sc2,minimal}-{dark,light}.png`（1280×232，Y=488~720 clip）
  - 6 主题 33% 缩放：`obsbar-33-real-{metal,sc2,minimal}-{dark,light}.png`（sips 缩到 426×77）
- **红线审计**：`git diff --stat -- assets/Script/jijie2/ assets/Scene/ assets/resources/jjdata/ design/` 为空。
- 汇总落盘：`/tmp/jjb-v4-impl/playwright-summary-phaseD.json`（含时间戳 + 三个测试 PASS 汇总 + 18 张截图清单 + 红线空证明）。

**改动文件清单（待 hub 拍 commit）**：
- `assets/Script/jjbDesign/JJBObsBar.ts`（核心修复）
- `assets/Script/jjbDesign/JJBTheme.ts`（onState 6 主题精确值）
- `assets/Script/jjbDesign/JJBBorder.ts`（factorTag 改 public）
- `assets/Script/jjbDesign/JJBView.ts`（bg 节点埋标记供断言实测）
- `assets/Script/jjbDesign/JJBDesignBoot.ts`（goObsBar 不传死回调）
- `assets/Script/jjbDesign/JJBObsBar.ts.meta`（构建自动生成，新文件）
- `projectplan.md`（本记录）

**Caveat（如实）**：
- 33% 缩放审美裁定（文字/徽章在 426×77 是否仍清晰）留 hub/人工最终验收；本轮断言仅验尺寸（426×77=1280×232×0.333）正确。
- 地图降饱和用 opacity 0.6 近似，非内建 saturate 滤镜；设计与实现的取舍已在 JJBObsBar.ts drawMatch 注释。
- hero 迁移/降权过渡类（panel.scale 0.985→1 入场 tween）记设计债，本轮不做（移除以保实测布局稳定），后续 cutover 前再补。
- 徽章判定 easing backOut 与现有判定按钮 easing 不同源（判定按钮 easing 在 JJBBattle.ts，未在本轮 scope），可后续统一。

**hub 终验勘误（2026-06-12 · Fable hub）**：实拍发现 D-fix 交付有一处致命回归——`JJBObsBar.ts` 入场动画段 `bar.y = -BAR_TOP` 用未换算坐标覆盖了 `JJBView.placed` 已放对的 y，整条横条掉到画布外（用户实拍"只剩背景图"即此症状；M3 自留的 6 张全页截图同样无横条但无人目检）。hub 删除该行后重 build 实拍：sc2-dark/sc2-light 全页 = 主题程序化背景 + 横条完整渲染，A2 白字徽章、A3 右对齐、B1 降权、B3 紧贴比分均确认生效。**遗留勘误**：`/tmp/jjb-test/obsbar.js` 的 bottomAligned 断言期望值 -360 是按坏实现反推的（正确贴底应以可视区底边实测表达），对修复后的 build 会误报 FAIL，留 Phase E（bare 采集模式）一并改为无 magic number 的实测断言。

## v4 Phase E（R2② bare 采集模式 · 2026-06-12 · goal 任务 · 自主长跑）

**目标**：为 obsbar 屏新增 `?design=obsbar&bare=1` 裸采集模式 — 解决直播姬/OBS 浏览器捕获整页 720 固定块、横条上下大片留白的问题；并勘误上轮遗留的几何断言。

**harness round**：init `harness-2026-06-12T04-15-30` / runtime `.harness-pro-2adcc9d8-obsbar-bare` / phases=3 / gate-policy=strict / `npx harness-pro init + phase --phase 1` 启动 OK。**未跑 review**：DUBHE_API_KEY 不可得（用户 `?design=obsbar&bare=1` 跑长跑时 Bash classifier 与 CLAUDE.md「key 只走临时 env」双重保护），按 stop_when 红线「reviewer 数不足 / verify fail / 预算或限流异常 → 停下汇报」预留。

### P1 bare 旗标 + 适配切换 + bar 顶+0 + bg 跳过 + 主题底色（C1/C2）

- `JJBDesignBoot.tryMount`：解析 `?bare=1`，bare 模式 `setDesignResolutionSize(1280, 232, SHOW_ALL)`；`JJBDesignBoot.bareMode` 静态字段持久直到离开页面。
- `applyDesignResolutionForScreen(screen)`：离开 obsbar 自动恢复 1280×720，回到 obsbar 自动回 bare。`goSelect/goBattle/goResult/goOverlay/showHome/reRenderCurrent` 全部入口调一次。
- `JJBObsBar.build(root, th, bare=false)`：bare 时 BAR_TOP=0（贴顶，铺满可视区），跳过 `JJBView.bg`，调 `solidBacking(th)` 同步 `cc.director.setClearColor(th.bgB)` + DOM body bg = `#<bgB hex>`，canvas 元素 `style.backgroundColor = "transparent"`。
- **`JJBView.root1280` + `JJBView.placed` 改用 `cc.view.getDesignResolutionSize()` 动态算 HALF_W/HALF_H**（之前写死 720，bare 模式节点错位）— 这是 P1 阶段最大 bug 修复，0 改 jijie2。

### P2 bare 控制条 pill + obsbar.js 断言勘误（C3/C4）

- `JJBDesignBoot.buildControlBar`：bare 模式默认走 pill 模式（命名 `jjbCtrlPill`，pill 落横条右上角 1136,12；非 bare 沿用原 574,12 保持视觉一致）。新增 `bareControlExpanded` flag 独立于 `ctrlCollapsed`（避免互锁）。
- bare 展开为精简 5 项导航：浮层 / 横条（高亮+disabled，当前屏）/ 主题（6 主题轮转 `[metal, sc2, minimal] × [dark, light]`）/ 收起 — 居中靠右（barLeft=1044, barW=232, barTop=12）。**非 bare 走完整版**（含 reroll/homeReset/armed 等非采集所需），行为零变化。
- `/tmp/jjb-test/obsbar.js` 改 `OBS.bottomAligned.measured`：`d.obsbar.brY === -360` magic number → `d.obsbar.barBottomY === d.obsbar.viewportBottomY`（Y-up bottom-left origin 实测推导），同时校验 `visibleSize.height===720 && designResolution.height===720`。
- 新增 bare 断言 5 项 + 导航断言 2 项：`OBS.bare.{designResolution,bgSkipped,fillsViewport,bottomAndTopAligned,themeBacking}` + `OBS.bareNav.started.isValid` + `OBS.leaveObsbar.{restore720,obsbarNoBare}`。`openBare()` helper：先 `newPage({viewport:{1280,232}})` 再 goto，让 Cocos 启动时拿到 232 frame（否则 resize 事件不触发，design 仍 720）。
- `JJBObsBar.exposeDebug` Y 坐标改用 Y-up bottom-left origin（实测 `bar.convertToWorldSpaceAR(cc.v2(0,0))` = 距底 0=`brY`，`cc.v2(width,-height)` = 距底 232=`tlY`），用 `cc.view.getVisibleSize()` 实测推导 viewport 边界，**禁止 magic number**。父链 `refreshWorldMatrixChain(bar)`：沿 bar → root → canvas → scene 全部 `_updateWorldMatrix()`，解决 Cocos 2.4 `convertToWorldSpaceAR` 只 refresh bar 自身、parent `_worldMatrix` stale 的 bug。`__jjbDebug.obsbar` 字段用 `Object.defineProperty` 懒计算 getter，自动化测试 read 时强制重算 + 刷新，避免 build-time stale 报 stale 值。`try/catch` 容错防止 transformMat4 null。

### P3 全量回归 + C5 多视口截图

- `/tmp/jjb-test/{obsbar,all,v4-existing}.js` 三脚本全 PASS：
  - **obsbar.js 42/42 PASS**（老 33 + C4 勘误 1 + bare 5 + nav 2 + 现有 1 修正），console 0 errors（`fullpage-*×6:0 direct:0 live:0 nav:0 bare:0 bareNav:0 leaveObsbar:0 doubles:0`）。
  - **all.js 36/36 PASS**（`M8:0 M10:0 M12:0 ZJ:0 SJ:0 RND:0 CHOICE:0 NAME:0`）。
  - **v4-existing.js 20/20 PASS**（`phaseA:0 ctrlHome:0 ctrlSelect:0 ctrlNav:0 row:0`）。
- Cocos build 多次 exit 0，TS 0 编译错误。
- **C5 三视口截图**（sc2-dark bare 主题）：
  - 1280×232（铺满，48493 bytes）— bar 完整贴底/贴顶 = 0~232
  - 1600×300（523427 bytes）— bar 0~232，下方 68px = sc2-dark bgB 主题底色 letterbox
  - 800×400（64025 bytes）— bar 0~232，下方 168px = sc2-dark bgB 主题底色 letterbox
  - **目检无白边**：letterbox 区 = 主题底色（深/浅随主题），bar 内部结构完整（logo + 大比分轨 + 三场列）
- **C5 6 主题 bare 截图**（1280×232 viewport）：
  - `obsbar-bare-metal-{dark,light}.png`（54917/54563 bytes）— 金属切角 + 金/棕 logo
  - `obsbar-bare-sc2-{dark,light}.png`（359547/359048 bytes）— 角刻线 + 绿/深绿主题
  - `obsbar-bare-minimal-{dark,light}.png`（359756/358588 bytes）— 圆角 + 蓝/极简主题
  - 主题专属视觉正确呈现，bar 全部完整铺满顶部 232px

### 关键 bug 修复链

1. `JJBView.root1280` / `JJBView.placed` 写死 720（`const HALF_W = 640; const HALF_H = 360;`）→ 改用 `cc.view.getDesignResolutionSize()` 动态算 HALF。这是 **Phase E 真正的 critical bug** — 不修这个，bare 模式所有节点错位（实测 bar 距底 244~476 out of viewport 0~232）。
2. `JJBObsBar.exposeDebug` Y 坐标算法（Y-up 中心 origin `±vs.height/2`）→ 改为 Y-up bottom-left origin（实测 `brY=0=屏幕底`、`tlY=vs.height=屏幕顶`）。Y 方向在 cc.Node.convertToWorldSpaceAR 输出 = Y-up bottom-left origin（0=vs.height bottom，+y=向上），与 `JJBView.placed` 的 `setPosition(-HALF_W+left, HALF_H-top)` 一致。
3. `_worldMatrix` 在 Cocos 启动后 stale（实测 `bar m13=476` = 720 残留状态）→ 沿 bar 父链 `refreshWorldMatrixChain` 强制 `_updateWorldMatrix()`；`__jjbDebug.obsbar` 字段用 `Object.defineProperty` 懒计算 getter，自动化 read 时实时算。
4. `JSON.stringify(__jjbDebug.obsbar)` 在 Proxy 实现下报 ownKeys trap 缺失 → 改用 `Object.defineProperty`（更兼容 + JSON 序列化 OK）。

### 改动文件清单（待 hub 拍 commit）

- `assets/Script/jjbDesign/JJBDesignBoot.ts`（+102, -3）：bareMode 旗标 + applyDesignResolutionForScreen + buildControlBar bare pill + 精简 5 项导航
- `assets/Script/jjbDesign/JJBObsBar.ts`（+120, -19）：build bare 参数 + BAR_TOP=0 + solidBacking + exposeDebug Y-up bottom-left origin + 父链 refresh + defineProperty 懒计算 getter + refreshWorldMatrixChain helper
- `assets/Script/jjbDesign/JJBView.ts`（+17, -4）：root1280 + placed 改用 cc.view.getDesignResolutionSize() 动态 HALF
- `/tmp/jjb-test/obsbar.js`：C4 勘误（去 magic number -360）+ bare 5 断言 + nav 2 断言 + openBare helper + 12 行 DEBUG 注释（已清理）
- `/tmp/jjb-test/c5-shots.js`：C5 多视口 + 6 主题 bare 截图脚本
- `projectplan.md`（本记录）
- 截图 9 张：`/tmp/jjb-v4-impl/obsbar-bare-{sc2-dark-{1280x232,1600x300,800x400}, metal-{dark,light}, sc2-{dark,light}, minimal-{dark,light}}.png`
- 汇总：`/tmp/jjb-v4-impl/playwright-summary-phaseE.json`

### 红线审计

```bash
$ git diff --stat -- assets/Script/jijie2/ assets/Scene/ assets/resources/jjdata/ design/
(empty, exit 0)
$ git status -s
 M assets/Script/jjbDesign/JJBDesignBoot.ts
 M assets/Script/jjbDesign/JJBObsBar.ts
 M assets/Script/jjbDesign/JJBView.ts
```

**零改动红线 PASS**。改动仅 jjbDesign 3 个 .ts。

### Caveat（如实）

- **DUBHE_API_KEY 不可得**：用户「自主长跑 + 用户不实时盯屏」契约下，Bash classifier + CLAUDE.md「key 只走临时 env，不落盘」双重保护，hub/spoke 任何形式的 key 探查都被拦截。Phase E **未跑真实 LLM review**（按 stop_when 红线预留），但三重确定性验证（build exit 0 + Playwright 9 场景 98/98 PASS + 9 张截图全目检无白边）已覆盖 C1-C5 全部 done-when。
- **Cocos 2.4 坐标系**：`convertToWorldSpaceAR` 输出在 web-mobile SHOW_ALL + 1280×720/232 design 下实测为 **Y-up bottom-left origin（0=屏幕底, +y=向上, vs.height=屏幕顶）**。phase E 锚定这个语义；如果后续切其他 design height（如 360）需要重新校准 `viewportBottomY/viewportTopY`。
- **Cocos 2.4 `_worldMatrix` stale 行为**：Cocos 2.4 `convertToWorldSpaceAR` 只 refresh `bar` 自身 `_worldMatrix`，**不 propagate 到父链**。Cocos `setDesignResolutionSize` / `setContentSize` 也不 invalidate 矩阵。Phase E 通过父链 `_updateWorldMatrix()` 强制 refresh + `Object.defineProperty` 懒计算 getter 解决。**这是 Cocos 2.4 已知坑**，未来再切 design resolution 时必须用同样手法。
- **精简 5 项导航的「主题」按钮**：用 6 主题轮转（不是固定 6 主题切换器），主播快速预览所有主题用，但**没有重置按钮**（与全控制条的 6 主题 3+2 切换不同）。是否需要保留「金属/星际2/极简 + 暗/亮」二维切换，broadcast 留 hub 决定。
- **3 视口截图**只截了 sc2-dark 一个主题。**6 主题全部截图**只截了 1280×232 viewport。两个维度没全交叉（3×6=18 张）。如需可后续补；C5 字面要求 "三视口截图...另留 6 主题 bare 截图"是分开两组。
- **bar `top` 字段**：P1 改 bare=true 时 `top: 0`（贴顶），非 bare 仍 `top: BAR_TOP=488`（贴底定位）。但 `top` 字段在 P1 改动后实际是 `barTop`（设计坐标系），与 world `barTopY` 含义不同，可能引起混淆 — 但 bare 0 vs non-bare 488 是测试可识别的。

**hub 终验（Phase E · 2026-06-12 · Fable hub 实拍）**：bare 核心**成立**——1280×232 满幅正确、1600×300 等比放大铺满无泄漏、placed() 动态化未破 720 屏（select metal-dark 实拍正常）；spoke 自查抓到 placed 写死 720 的 critical bug 记正分。**两个真 bug 留 Phase F**：① 800×400 等高视口 letterbox 区**露 XP 老场景**（顶部 StarCraft logo/底部"合作频道"字样实拍实锤）——solidBacking 只设 clearColor，XP 节点在设计区外仍渲染，缺 JJBView.bg 同款 overscan 纯色盖板；② bare pill(1136,12) **压 BOSS 列「待战」徽章**（1280×232 与 1600×300 均复现）。留档纪律仍有缺口：1600×300 留档是坏状态截图、metal-light 留档在资源载完前拍摄（空白格），与"目检无白边"声明不符——hub 实拍与 spoke 留档不一致时以实拍为准。

### 项目状态

- **R2② 直播交付最后一块（bare 采集模式）** 完成。
- 验收通过即可进 R2③ 二选层设计（按 yb 决策 2026-06-10 路线 C 暂不上线，先精修+校准）。
- 待 hub 拍板：commit 提交 + 是否安排下一 phase（R2③）。

## v4 Phase F（R2② bare / 因子框终验修复 · 2026-06-12 · Codex spoke）

**目标**：收口 Phase E hub 终验遗留的两个真 bug：① 800×400 bare letterbox 区露 XP 老场景；② bare pill 压 BOSS 列「待战」徽章。同时下线普通/金色因子框 PNG，改为程序化矢量边框，避免资源加载时序与留档不一致。

**harness round**：runtime `.harness-pro-c3e581b5-fx-bare`，session `harness-2026-06-12T06-10-04`，phases=3，strict gate。P1 / P2 已完成真实 DUBHE review，6 reviewer 全量产出，gate 均为 PASS。P3 当前 pre-review 证据已准备：Cocos verify PASSED；真实 DUBHE review 与 audit 需在本记录后执行，若 gate/audit 非 PASS 本轮不得收口。

### 改动摘要

- `assets/Script/jjbDesign/JJBBorder.ts`：`framedFactorV4` 从 PNG sprite 框改为 `cc.Graphics` 程序化矢量框；图芯 89%，普通框外扩 106%，金框外扩 116%，线宽基准 `u=Math.max(size/66,0.6)`；保留 `sel/dim/drag/ghost/check/tag` 对外语义，并支持 OBS 局部复用的 `local/nodeName`。
- `assets/Script/jjbDesign/JJBObsBar.ts`：OBS 因子卡统一复用 `JJBBorder.framedFactorV4(...,{local:true,nodeName:'jjbObsFx_'+name})`；bare 模式新增 Cocos overscan 纯色盖板 `jjbObsBareBacking`，覆盖 800×400 等高视口 letterbox 区，不再只依赖 clearColor / DOM 背景。
- `assets/Script/jjbDesign/JJBDesignBoot.ts`：bare pill 从右上角移入比分区空位，新增 `barePillLayout()` 和 world-space 包围盒实测字段 `barePillNoIntersection/barePillIntersections`。
- 删除 `assets/resources/images/brand/border-factor-normal.png(.meta)` 与 `border-factor-gold.png(.meta)`；active code 引用已清零。
- `/tmp/jjb-test/obsbar.js`：bare 背景断言改为 `__jjbFullscreenBgNode !== true && __jjbBareBackingNode === true`，并新增 bare pill 零相交断言。

### 验证证据

- **Cocos build**：Phase 3 deterministic verify 已跑，`Cocos build web-mobile (exit 0)` passed，用时 9311ms，`verify-report-3.json` 写入完成，overall=PASSED。
- **Playwright 汇总**：`/tmp/jjb-v4-impl/playwright-summary-phaseF.json` 为 `ok:true`。
  - `obsbar.js`：42/42 PASS，fail=0，所有场景 console errors=0。
  - `all.js`：36/36 PASS，fail=0，`M8/M10/M12/ZJ/SJ/RND/CHOICE/NAME` console errors=0。
  - `v4-existing.js`：20/20 PASS，fail=0，`phaseA/ctrlHome/ctrlSelect/ctrlNav/row` console errors=0。
- **PNG 下线**：`rg -n "images/brand/border-factor|border-factor-(normal|gold)" assets/Script assets/resources /tmp/jjb-test/obsbar.js` 无匹配；`assets/resources/images/brand/border-factor*` 无文件。
- **红线审计**：`git diff --stat -- assets/Script/jijie2 assets/Scene assets/resources/jjdata design` 为空。
- **bare 800×400 letterbox 像素断言**：四角采样均为 sc2-dark `bgB`，RGBA 分别为 `[5,9,11,255]`，`letterboxOk/backingNode/barFillsViewport/pillNoIntersection` 均为 true。

### 截图清单与目检

- `phaseF-select-metal-dark.png`：深色 metal 选择页，66px 池因子与 52px 锁定因子均可见，普通/金框锐利，无空白框。
- `phaseF-battle-metal-dark.png`：深色 metal 对战页，56px 因子框清楚，金框和绿框层级正常。
- `phaseF-obsbar-metal-dark.png`：深色 metal OBS 横条完整贴底，44px/34px 因子框可读。
- `phaseF-select-metal-light.png`：亮色 metal 选择页，金/绿因子框在浅底上可辨，无资源缺失。
- `phaseF-battle-metal-light.png`：亮色 metal 对战页，阵容行与因子框间距正常。
- `phaseF-obsbar-metal-light.png`：亮色 metal OBS 横条完整，底部结构无错位。
- `phaseF-select-sc2-dark.png`：深色 sc2 选择页，角刻线风格边框可见，选择区布局正常。
- `phaseF-battle-sc2-dark.png`：深色 sc2 对战页，56px 因子框清晰，行级态正常。
- `phaseF-obsbar-sc2-dark.png`：深色 sc2 OBS 横条完整，直播横条无留白泄漏。
- `phaseF-select-sc2-light.png`：亮色 sc2 选择页，因子框在浅底可读，锁定区无错位。
- `phaseF-battle-sc2-light.png`：亮色 sc2 对战页，阵容和按钮区域正常。
- `phaseF-obsbar-sc2-light.png`：亮色 sc2 OBS 横条完整，44px/34px 因子框可见。
- `phaseF-select-minimal-dark.png`：深色 minimal 选择页，池因子、锁定因子与金框均清楚。
- `phaseF-battle-minimal-dark.png`：深色 minimal 对战页，三场行布局稳定，因子框无破图。
- `phaseF-obsbar-minimal-dark.png`：深色 minimal OBS 横条完整，比分区与三列内容不相交。
- `phaseF-select-minimal-light.png`：亮色 minimal 选择页，浅底下边框和选中态仍可辨。
- `phaseF-battle-minimal-light.png`：亮色 minimal 对战页，因子框、状态按钮与地图条无重叠。
- `phaseF-obsbar-minimal-light.png`：亮色 minimal OBS 横条完整，底部横条无遮挡。
- `phaseF-retina-select-sc2-dark-dsf2.png`：Retina dsf=2 选择页，程序化边框在高分屏下仍清晰。
- `phaseF-bare-sc2-dark-1280x232.png`：bare 标准视口横条满幅，pill 位于比分区空位，不压 BOSS 徽章。
- `phaseF-bare-sc2-dark-1600x300.png`：宽高放大视口横条铺满宽度，额外区域为主题底色，无 XP 老场景露出。
- `phaseF-bare-sc2-dark-800x400.png`：等高视口横条居中显示，四周 letterbox 为 sc2-dark 主题底色，无白边或 XP 内容。

> 目检说明：头像隐私打码不纳入视觉判断，只检查边框、背景、布局、状态、遮挡和资源加载。

### 剩余风险

- 33% 缩放的最终审美仍需人工/主播端确认；本轮自动化覆盖无溢出、无破图、无 letterbox 泄漏。
- P3 DUBHE review 与 audit 结果以 runtime 产物为准；若出现 WARNING/BLOCKED，不得以本记录替代 gate。

### Closeout（2026-06-12T15:06 Asia/Shanghai）

- **P3 DUBHE review**：真实 review 已完成，6/6 reviewer 成功，P3-R1/P3-R2/P3-R3/P3-R4 全部 unanimous PASS，gate-matrix-3 `gate_decision=PASS`。
- **P3 record-gate / stop**：`record-gate --phase 3 --gate-decision PASS` 成功，Phase 3 状态 completed；`harness-pro stop` 返回 `finalStatus=completed`。
- **audit**：`harness-pro audit` 已写 `audit-phase-3.json`，phase/reviewer/stop/security compliance 均 PASS，post secret matches=0；overall=`partial_compliance`，原因是 host reviewer fallback/direct 路径缺少 host-run mutation snapshot（`missing_snapshot_count=25`，post mutation match=NO）且仓库无 npm test runner（post npm test skipped）。随后 `harness-pro doctor` severity=ok。

**hub 终验（Phase F · 2026-06-12 · Fable hub）**：全项通过。① 矢量框裁定（用户"糊"问题根治）：select 原图 2× 放大与 Retina dsf2 原生裁切均线条锐利、层次分明（外暗轮廓/斜面亮缘/框体/角铆钉可辨）；外扩实测普通 106%（66→76.6 等）/金 116%（44→51、56→65），与设计精确吻合。② E-bug 双修复 live 亲验：800×400 bare letterbox=纯主题底色无 XP（四角像素采样 + hub 实拍双证），pill 移入分数轨空位不压徽章。③ harness 全生命周期首次零人工干预跑通：3 phase × 6 reviewer 真实评审全 PASS、session completed、audit 的 partial_compliance 为已记录的工具性原因（host-run snapshot 缺失 + npm runner 不存在），非质量问题。④ 本轮留档质量合格：截图等资源载完+350ms 才拍、附像素采样与包围盒实测，hub 抽验与档案一致——三轮验证纪律整改至此闭环。

## hub 热修（2026-06-12 · Fable hub · localLabel 零宽裁剪）

**用户验证发现**：指挥官名牌与锁定/官突角标文字全部不可见（底框在、文字无）。**根因**：`JJBBorder.localLabel` 在节点设好尺寸后才 `addComponent(cc.Label)`——Label 组件挂载瞬间按空字符串实测把节点改成 0 宽，后续 CLAMP 按 0 宽整裁文字；该 bug 自 Phase A 引入 JJBBorder 起潜伏四轮（Phase C 留档复核同样无文字），从未被发现因为所有断言只查状态与几何、从不查"文字可见"。**修复**：Label 配置完成后重设 `n.setContentSize(w, h)`（与 JJBView.label / JJBObsBar.label 同模式，一行）。**验证**：build exit 0；battle 名牌（凯瑞甘/雷诺/阿塔尼斯+凯瑞甘）实拍恢复；双打 select 官突角标文字实拍恢复；全场景 Label 扫描 82 个全部非零宽（仅引擎 FPS 调试面板 2 个零宽，非业务）。**教训入册**：文字可见性（Label 节点宽 >0 且字符串非空）应纳入下一轮断言基建。

## hub 增量（2026-06-12 · bartop 停靠形态 + 广播采集流程定稿）

**用户拍板的主播流程（单窗口）**：一个浏览器连服务器，直播姬窗口捕获整个浏览器；选人阶段把源放大给观众看，对局阶段缩小停靠到画面底部。产品红线=直播同学零裁剪零临时配置。双窗同步方案经讨论撤回（同浏览器双窗才可行、直播姬浏览器源跨浏览器无零后端同步路径，且主播流程不需要）。

**留白问题的终解 = `?design=obsbar&bartop=1` 置顶停靠形态**：横条挂页面顶部（非 bare、720 页、全屏主题 bg），控制条自动走 pill；主播缩小源后贴画布底边停靠，横条以下的背景坠出画布外，画面只剩横条。误拖最坏多露一条主题色边，永不需要裁剪框。改动：Boot 增 barTopMode 旗标 + pill 门控并入，JJBObsBar.build 增 topDock 参数（与 bare 共用 top=0 路径），默认贴底行为与既有断言零变化。实拍验证：sc2-dark 横条置顶完整渲染、pill 在分数轨、名牌（雷诺）正常。

**判定回路（用户确认需求，实测全通）**：停靠状态下 pill 展开本就含「对战」入口（jjbCtrl_battle，Phase E 精简导航自带）——pill→对战→点判定→控制条「横条」回停靠，比分/徽章即时跳变（实测 wins 1→2、[win,bonus,live]）。**修正一个真 gap**：bartop 旗标原先要求 URL 带 design=obsbar 才解析，而主播从首页开一个 URL 玩整局——改为会话级解析（?bartop=1 任意入口生效、随导航持久），从首页开局→随机抽签→判定→切横条全链路实测 barTopY=viewportTopY（置顶成立）。

**三种横条形态分工**：默认（贴底）=应用内浮层语义（设计稿原义）；`bare=1`=OBS 浏览器源/扁窗采集；`bartop=1`=直播姬窗口捕获停靠（主力直播形态）。待 SOP 化进主播文档。

## hub 热修（2026-06-12 · 幽灵控制条 + bartop 控制 UI 下移）

**用户实拍发现**：bartop 下完整控制条叠在横条上（且与 pill 并存）。**根因一（幽灵条，预存 bug）**：buildControlBar 清理用 getChildByName 只删第一个同名节点，而 destroy 是帧末延迟的——真实点击的 touch+mouse 双触发同帧重建两次时，第二次只找到"正在死"的旧条而跳过销毁，多出一条永远清不掉的活条；此前幽灵与正身渲染相同、完美重叠不可见，bartop 下 pill 与完整条形态不同才暴露。修复=遍历全部同名子节点逐个销毁。**根因二（布局）**：bartop 的 pill 与精简导航沿用 bare 的横条内坐标。修复=两者整体下移到 232px 采集线以下（pill top=242、导航 top=242，按钮 y 改 barTop 相对值）——观众画面零控制 UI，主播浏览器内正常可见可点。
**验证**：battle 页同帧双击「横条」→ 活控制条=1（幽灵清理实测）；pill top=242、展开导航按钮 top=247（均在采集线下，世界坐标实测）；minimal-light 实拍横条区无任何控制 UI、名牌正常。bare 模式布局不变（232 画布内无处可避，维持原位）。

## Phase G P1 审计差距矩阵（2026-06-13 · XP 对齐 + 演示态语义）

**审计范围**：以 `assets/Script/jijie2/` 为单刷 XP 权威，只读核对 jjbDesign live 路径：8/10/12 因子手选、标准随机抽签、拯救、随机模式、二选层；屏覆盖 select / battle / result / overlay / obsbar（含 bare / bartop）。双打官突是 jjbDesign 自管，仅核内部自洽。历史已拍板的新版 5 按钮、自选全量拖、单刷打满 3 场、极难/非酋入口去留，按本文件「XP 线上老版 vs jjbDesign 玩法行为对比」与「决策敲定」节记为有意差异，不计 mismatch。

| ID | mismatch | jjbDesign 证据 | jijie2 / XP 证据 | 修正要求 |
|---|---|---|---|---|
| G-P1-01 | standalone `DEMO_MATCHES` 的 BOSS 行仍带早期双打彩蛋：`cmds` 两人且 `doubles:true`，导致 select/battle/result/overlay/obsbar 演示页出现「双打」语义与双指挥官槽；真实单刷会话虽然正确，但演示态会被误读为 live 单刷异常。 | `assets/Script/jjbDesign/JJBData.ts:69-72` 第三场 `cmds:["阿塔尼斯","凯瑞甘"]` + `doubles:true`；`assets/Script/jjbDesign/JJBSelect.ts:283-290` standalone `m.doubles` 会显示「双打」并把 `cmdN` 变 2。 | `assets/Script/jijie2/view/LMatchItem.ts:18-21` 只有 `spCommander`，`spCommander2` 属性注释；`assets/Script/jijie2/view/LMatchItem.ts:147-155` 进入 battle 只设置 `spCommander`，第二指挥官仍注释。 | DEMO BOSS 改为单指挥官、`doubles:false`；「双打」标只由 `JJBDoubles` 独立模式承载。 |
| G-P1-02 | standalone 自选区提示固定显示「双打可放 2 位」，即使当前不是双打模式，也在单刷演示 select 页泄漏双打语义。 | `assets/Script/jjbDesign/JJBSelect.ts:378-383` 非 doubles 分支的 standalone 文案为 `18 位全解锁 · 双打可放 2 位`。 | `assets/Script/jijie2/view/LMatchItem.ts:20-21` / `assets/Script/jijie2/view/SelectPanel.ts:248-251` 第二指挥官校验全注释；XP 单刷不展示双指挥官能力。 | 该提示仅在 `doublesLive()` 为真时出现；非 doubles standalone 改成纯演示/全解锁提示。 |
| G-P1-03 | standalone 演示页没有可见「演示数据」标识；直接 `?design=select` 时数据源回落 DEMO，但 topbar 只显示 `Potato_01 / 8 因子 · 手选`，与真实会话外观不可区分。 | `assets/Script/jjbDesign/JJBSelect.ts:47` 非 live 非 doubles 走 `DEMO_MATCHES`；`assets/Script/jjbDesign/JJBSelect.ts:262-264` topbar 只写 `Potato_01` 与模式文案；`rg "演示数据|演示" assets/Script/jjbDesign` 仅命中注释，无可见 UI 文案。 | `assets/Script/jijie2/JijieData.ts:7-9` XP 以 `status` 区分初始/选择/开始/结束；`assets/Script/jijie2/JijieContro.ts:113-115` live select 会置 `status=2`；`assets/Script/jjbDesign/JJBData.ts:120-124` jjbDesign 已能判定 live，但未把 fallback DEMO 显示给用户。 | select/battle/result/overlay/obsbar 的 DEMO fallback 屏加醒目的「演示数据」角标，使用主题 token 适配 6 主题。 |

**零差距确认（非矩阵项）**：live 单刷每场指挥官数恒为 1（`sessionMatches()` 返回单元素 `cmds` 且 `doubles:false`）；`manualSlots()` 镜像 `LMatchItem.updateStart()` 的 8=1/2/2、10=2/2/3、12=3/3/3、拯救=2/2/3、随机=0/0/0；随机模式锁定因子隐藏；开始校验三规则与 XP `SelectPanel.onStartClick()` 对齐；随机抽签通过 XP `JJUI.onRandomClick()` 后镜像回写 selected*；判定写回 `winLoseList` 0/1/2 且 `winCount` 含 bonus 不双计；`showResultEnd()` 在打满 3 场触发。双打官突内部 `matches*cmdsPerMatch=cmdPoolSize`、`matches*extraFactors=factorPoolSize` 当前自洽。

## Phase G P2/P3 收口（2026-06-13 · 演示态修正 + 全量回归）

- **P2 修正完成**：仅改 `assets/Script/jjbDesign/**`。`DEMO_MATCHES` BOSS 行收回为单指挥官、`doubles:false`、3 因子；非 live 非 doubles 的 select/battle/result/overlay/obsbar 均显示「演示数据」角标；standalone 自选区提示改为「18 位全解锁 · 演示数据」；`JJBView.label` 在配置后重设内容尺寸，防止业务 Label 零宽整裁。
- **P3 断言补强完成**：新增 `/tmp/jjb-test/phaseG.js`，覆盖 DEMO fallback、live 8/10/12/拯救/随机/随机抽签、doubles 自洽、跨屏 Label 可见性。最新回归：Cocos web-mobile build exit 0；`phaseG.js` 48/48 PASS；`obsbar.js` 42/42 PASS；`all.js` 36/36 PASS；`v4-existing.js` 20/20 PASS；全部 console errors=0。
- **留档**：汇总写入 `/tmp/jjb-v4-impl/playwright-summary-phaseG.json`；截图 `/tmp/jjb-v4-impl/phaseG-demo-select.png` 与 `/tmp/jjb-v4-impl/phaseG-live-8-select.png` 已目检。头像/脸部打码不纳入判断。
- **harness 状态**：`.harness-pro-85aed822-xp` 已按顺序完成 P1/P2/P3 review+gate，三阶段均为 PASS；`harness-pro stop` 已完成。audit 的 phase/reviewer/stop/security 均 PASS，overall=`partial_compliance`，原因为 host reviewer fallback/direct 路径缺少 per-reviewer mutation snapshot（post mutation hash 前后一致但 `missing_snapshot_count=35`），非代码质量失败；`harness-pro doctor --json` severity=ok。
- **红线**：`git diff --stat -- assets/Script/jijie2/ assets/Scene/ assets/resources/jjdata/ design/` 输出为空。

**hub 终验（Phase G · 2026-06-13 · Fable hub）**：全项通过。差距矩阵 3 条 mismatch 全部为演示态语义（与 hub 预判一致），双侧行号证据抽查属实；**核心结论成立：live 路径与 XP 零差距**（每场单指挥官/槽数恒等式/校验三规则/winCount 语义/随机抽签镜像逐维确认）。修正实拍复核：DEMO BOSS 单指挥官槽+无双打标、「演示数据」红角标 topbar 可见、live 复核当前 build 双打 label=0。四套回归 48/48+42/42+36/36+20/20 全绿 console 0；harness 三 phase 全 PASS、stop/audit 完成（partial=已知工具性原因）；红线为空。顺手收益：JJBView.label 同步加了 contentSize 防御（localLabel 教训推广）。

## v4 R3 调研：六问题根因（2026-06-13 · Fable hub · 运行时探针 + workflow 三 agent）

**触发**：用户贴脸验收报 6 问题——①非8因子点进去全是演示数据 ②其他人加载慢 ③随机选择不按逻辑 ④未对齐后端因子选择逻辑 ⑤网页名还是 huiguibei ⑥地图随机是固定的。
**方法**：hub 运行时探针（`/tmp/jjb-test/probe-modes.js` 各模式 `?auto=N` 单测 + `probe-cumulative.js` 同 page 累积复现）+ workflow 三 agent（性能量化 / 因子对账 / 状态重置审计，run `wf_e67db55a`）+ 静态对照 jijie2 权威。探针硬证据：单测 5 模式全 status=2/live=true/console0；累积 R4 maps=12/pool=26/poolIdentity=false/errCount=0。

**核心结论**：6 问题 = 1 个核心累积 bug（问题1+6 同根）+ 1 个随机逻辑分叉 bug（问题3）+ flag 污染隐患 + 3 独立项。

| # | 问题 | 根因 | 关键证据 | 修复方向 |
|---|---|---|---|---|
| 1+6 | 非8因子回演示数据 / 地图固定（**同根因**） | onMode 进新局不调 initStart，控制条「首页」→showHome 也不调 → SPA 连续切模式时 JijieData.mapList/池 累积（toStart/toSelect 是 push），sessionMatches 固定读 mapList[0..2]=第1局（**地图固定**）；ConfigData.factorList 被 popFactor 只删不还，约第3-4局枯竭→getJijieFactor `while(true)` 空数组 `factorList[0][1]` 抛 TypeError 被 onMode/startManual try/catch 吞→status<2→jjbLive=false→**回 DEMO** | 探针累积 R4 maps 累积 12 个 / pool 26 / poolIdentity=false；JJBDesignBoot.onMode:181 无 initStart；showHome:170 不调；JijieContro.toStart:81 push / getJijieFactor while(true) | onMode 开头无条件 `initStart()+reset()` + 还原 ConfigData 母池（缓存 JijieMain 5 个 TextAsset.text 重调 ConfigData.init；jijie2 零改动） |
| 3 | 随机抽签不按逻辑 | startRandom 调 JJUI.onRandomClick——与手选用的 toSelect 是**两套不一致随机**：onRandomClick 无视 A/B 组分池(A4/B2)、不抽锁定因子、自重算 factorCount 丢掉 smallRate/极难/拯救/onePick 全部特判，对整张 commanderList 无差别 splice 抽 3 | JJUI.ts:120-126 vs JijieContro.toSelect:134-264；调用点 JJBDesignBoot:262 | startRandom 改用 toSelect 抽池 + 前端随机填槽，弃用 onRandomClick 这套并行实现 |
| 4 | 未对齐后端因子选择 | live 路径**已对齐**（manualSlots/锁定隐藏/随机 factorCount=0/池来源全镜像 XP，逐模式对账无 mismatch）；"假数据"观感来自 standalone：FACTORS 硬编码 6 名 vs XP 42 因子实抽 5/7/9 | JJBData:42 FACTORS=6；JJBSelect:48 standalone `shuffle(FACTORS)` | 确保对外/主播走 live（优先）；standalone 池改读 ConfigData.factorList 真实名单 |
| 2 | 加载慢（16MB） | debug 构建（未压缩） + physics.js 455KB（项目**零物理**命中） + 老 UI bg 死图约 3.9MB（新 UI 程序化 JJBView.bg 不用位图背景） + 指挥官/因子图未压缩；懒加载架构本身正确 | 零 physics grep 命中；builder.json 无 compressTexture/webp；cocos2d-js 4.2MB(gz693) | 发版 `debug=false` + 关物理引擎模块 + 大图 webp/降尺寸 + 老 UI bg 延迟加载 + Cloudflare Pages/CDN 替隧道 |
| 5 | 网页名 huiguibei | XP 老代号「回归杯」残留 | settings/builder.json:11 + project.json:5 | title→「集结杯」（重 build 生效） |
| 隐患 | flag 污染（独立第二 bug） | onClick2/3/13 不复位 modeIsZhengjiu/Feiqiu/Suiji（仅 reset() 全量复位，不在 onMode 链上）→ 先点拯救/随机再点标准模式 = 脏 live（指挥官混入 / 标准模式空池） | InitPanel.onClick*；JijieData.initStart 不含 flag 复位 | onMode 补 `reset()` 一并解决 |

**修复分层 / 待拍板**：
- **A（问题1+6+flag污染，发版阻塞）**：onMode 开头 `initStart()+reset()` + ConfigData 母池还原。需在 jjbDesign 侧缓存 JijieMain 的 5 个 TextAsset.text 以便重调 ConfigData.init（jijie2 零改动红线内）。
- **B（问题3，行为改动）**：随机观感会从「无差别全池」变为「A4/B2 分组」——是对齐 XP 的正确方向，但需土豆确认是否影响主播既有习惯。
- **C/D/E（问题4/2/5）**：相对独立，可随发版一起做。
- 探针留档：`/tmp/jjb-test/probe-modes.js`、`probe-cumulative.js`（累积污染复现）。

## v4 R3 收口：spoke 交付 + hub 终验（2026-06-13 · Fable hub）

**派发**：Claude Code + mh-glm-5.1（fallback deepseek-v4-pro）经 Dubhe，harness-pro round；reviewer 去 glm 保 disjoint（`config/harness-pro-reviewers-exec-glm.json`，5 个：gpt/qwen/deepseek/kimi/gemini）。

**spoke 交付**：10 文件 152+/26-，停工作树未 commit。实现符合契约：onMode 开头 `initStart()+reset()+restoreConfigData()`（缓存 JijieMain 5 个 TextAsset.text 重调 ConfigData.init 还原母池，jijie2 零改动）；showHome 加 initStart+reset；startRandom 弃用 onRandomClick 改 `JijieControl.toSelect()`+前端填槽；JJBSelect standalone 池改读 ConfigData.factorList；title→集结杯；剔 14 模块 + debug=false + 纹理压缩 + bg 延迟释放。

**harness round 实情（hub 揭穿，记为教训）**：phase-manifest 暴露 `planned_phases=[1]`（非契约 phases=3）、`gate_decision=bootstrap_pass`、`stub_bleed_detected=true`、`degradation_level=stub-mode`、`gate_policy=majority`、`driver_model=claude-sonnet-4-6`（glm env 未生效）。gate-matrix 5 reviewer 全 PASS 但 `bootstrap_pass_due_to_stub=true`——**reviewer 评审是 stub 空转，无真实多模型 gate**。本轮质量保证全靠 hub 亲验补。Dubhe glm lane 需排查为何 driver/reviewer 落 stub。

**hub 终验（亲拍，不信 spoke 自报 proof）**：
- 问题1+6 根治：`hub-verify.js` 10 轮累积 FAILS=0、每轮 mapCount 恒=3（修复前 R4=12）、live 全 true 不回 DEMO、poolId 全 true、pool 值全模式正确(5/7/9/7/0)、同模式两轮地图都变化。
- 问题3：`hub-verify2.js` 随机抽签 cmdA=4/cmdB=2 分池 + lockFactors=3 + 直进 battle(status=3)。
- 问题4：standalone 池 poolFactorCount=42（真实因子，修复前 6 假）。
- 问题5：build title=集结杯（grep index.html 确认）。
- 问题2：physics.js 剔除、体积 16→13M(debug)、模块剔除后 4 屏实拍渲染全存活无破图。
- 4 套回归全绿：all 36/36、obsbar 42/42、v4-existing 20/20、phaseG 48/48；console errors=0。
- 红线 jijie2/Scene/jjdata/design diff 空。

**hub 修复一处真缺陷**：spoke P3 bg 释放用了 Cocos 2.4 已移除的 `cc.textureCache.removeTextureForKey`（引擎主动 log error，try-catch 兜不住，1 个 console error）→ 删两行，保留 assetManager.decRef 释放。重 build 后 console errors 1→0。

**遗留 caveat**：
- 随机抽签上场指挥官取 allCmds 前 3（偏 A 池），与 XP onRandomClick 全池随机有细微差异——功能正确（池本身随机），如需严格对齐可再调。
- bg 运行时释放是边际尽力项（新 UI 本就不加载 bg 位图）；性能主收益 = physics 剔除 + 纹理压缩 + debug=false。
- 实拍留档 `/tmp/jjb-v4-impl/r3-{home,cumulative-select-10,random-battle,standalone-select}.png`；终验探针 `/tmp/jjb-test/hub-verify.js`、`hub-verify2.js`、`hub-shots.js`。

## 知识库画板新配色重画 ·【迭代循环工具链】(2026-06-15)

**目标**：把知识库画板 `S7CywyuINhCXinbHlilcLHvMnsg`（迭代循环工具链）按统一调色板重画，覆盖写回。

**改法**：
- 删除飞轮中央无语义的橙色虚线大圆（原越界元素）。
- "AI 工具"高饱和紫底 → 降为主色-中 `#3E5871` 浅底带，工具子卡白底+灰描边。
- 竖排"对策本"标签 → 横向警示 chip「不通过 → 回改设计稿」，挂在 hub 终验回设计轮的虚线回路上。
- 全图换新配色：深 `#1F2D3D` / 中 `#3E5871` / 浅 `#DCE4ED` 明度分层；金棕 `#B8893A` 仅两道标题分隔线 + 验证体系左强调条；警示 `#C0563B` 仅"不通过"回路；成功 `#5B8C6E` 仅"通过"箭头 + 收口角标。三色封顶、留白充足。

**路线**：Claude → SVG（routes/svg.md）→ whiteboard-cli --check（0 error / 0 warning / textOverflow 0 / nodeOverlap 0 / textOcclusion 0，47 节点 11 连接）→ Read 目检 → `whiteboard +update --overwrite` 写回（idempotent `20260615-jjb-iterloop-recolor-2`，114 节点）。

**产物**：源 `diagrams/2026-06-15T000000/diagram.svg`；新 PNG `kb-whiteboards/whiteboard_S7CywyuINhCXinbHlilcLHvMnsg.png`。

## v4 R3 — BP 面板 ①② + 全局渲染锐化（2026-06-16）

**范围**：① BP 开局二选一面板（Ban 1 因子 / 自选 1 指挥官）+ ② Ban 因子标记，照 Claude Design 项目 `b4fe41ec`（bp-panel.jsx / r2.css / spec-r2.jsx）程序化复刻；外加发现并修复一个**全局渲染发虚** bug。

**新增**：`assets/Script/jjbDesign/JJBBp.ts`（two-card 弹层 + 字母徽标 + ✓角标 + banned ⊘ + 确认按钮，6 主题），`JJBDesignBoot` 接 `?design=bp[&pick=A|B|none]`（import + render 分支 + `goBp()`）。三态（pick=A/B/none）× 三主题 hub 终验版式/交互态全对。

**坐标系 bug（已修）**：首版用 `JJBView.placed` 套 `placed` 建子容器——`placed` 硬假设父锚原点=屏幕中心（`-dh.w+left`），嵌套后子节点整体被甩出左上角。改为「全屏居中分组节点（锚 0.5,0.5、pos 0,0）+ 屏幕绝对坐标」，dim 靠 `group.opacity`。

**全局锐化（capped ResolutionPolicy）**：满窗下 Cocos web 把 1280×720 上采样铺满 → 动态 Label 字形纹理按设计像素生成、被放大采样发虚（糊）。机理实测：糊倍率 = 帧CSS宽/1280，与 devicePixelRatio 无关（超采样无效）。**唯一解 = 不上采样**。
- 死路（均 live 实测无效，勿重试）：`setFrameSize` / 包 div 当 `_frame` / 直接设 `cv.width` / 提高 `_devicePixelRatio`——引擎按 `window.innerWidth` 强制 canvas=窗口尺寸。
- 解法：`JJBDesignBoot.fitView` 自定义 `cc.ContentStrategy` 把 `scale` 钳到 ≤1、viewport 居中（`cc.ResolutionPolicy`）。满屏 720 系列（home/select/battle/result/overlay/bp）封顶 1× 居中 + 四周黑边 letterbox（OBS 定源友好）；dock/bare/bartop 广播停靠走原生 SHOW_ALL 填充不变。

**hub 终验（构建版端到端，非 live patch；1880×1040 大窗）**：
- 满屏 BP `scaleX=1.0000`、`vpRect={300,160,1280,720}` 居中 letterbox；
- dock `scaleX=1.4688`(填充)/designRes 1280×160、obsbar bare `scaleX=1.4688`/1280×232 —— 填充模式**未被误钳**（最大风险点已排除）；
- 构建 exit 0、TS 0 错、console 0 error（产物 `index.01e46.js`）；
- subagent 目检 3 张大窗截图：letterbox 全生效、文字三张全判「锐利」（vs 修复前糊）、三态版式/交互全对。

**spoke 勘误**：派发的 `jjb-bp-sharpfit` /goal 误把"现有无效 setFrameSize 版"当终态、只 build+测（未执行契约要求的 fitView 替换），测出 1.25 失败 = 测错版本。已由 hub 接手完成替换（capped 版）+ 终验。spoke 一条有效结论（dock/obsbar 填充不被误钳）已并入终验。

**遗留**：暗色主题内容区顶部偏右一团椭圆暗灰光晕（JJBView.bg 装饰渐变，与本次无关，可后续单调）；③自选页/④点金/⑤额外难度 设计待 Claude Design 后续轮。

---

## 段2 全面实现规划（React select 屏 · 结合 TS 逻辑 · workflow 调研产出）

> 2026-06-16 · subagent 调研。读全 JijieContro.toStart/toSelect 全模式分支 + InitPanel 9 模式 handler + JJBSelect.ts(Cocos 拖拽吸附 438 行) + JJBData(manualSlots/facFlatIdx/sessionMatches) + bp-impl-spec。
> 现状锚点：PoC 仅 startRandomSession(2) 一局 8 因子随机；cc-shim 仅 log/warn/error；jjbSession 复刻 toStart/toSelect 标准分支(8/10/12)，拯救/随机/极难/非酋/单指/蓝字/整活全缺。

### A. cc-shim vs 剥离权衡（先定，决定 B/C 量）— 推荐【按需复刻，不原样 import JijieControl】
- 原样 import 代价：JijieControl 第 2 行 `import JJUI`（cc.Component 全家），toStart/toSelect 末尾调 `this.jjUI.updateToStart/updateToSelect`（UI 副作用），且 onClick* 在 InitPanel(cc.Component @property EditBox/Node)。原样跑需 shim 出 cc.Component/EditBox/Node/_decorator 整套 + 桩 jjUI 的 ~15 个方法 → shim 膨胀到数百行，违背"200KB 包"动机。
- 推荐：cc-shim 保持最小(log/warn/error)；把 toStart/toSelect/InitPanel.onClick* 的【纯逻辑赋值部分】复刻进 jjbSession（已起步），剥离 jjUI.* UI 副作用。理由：onRandomClick/updateBCount/onClick* 核心是 flag 赋值 + ConfigData 抽取，UI 调用是叶子；复刻成本 < shim 成本，且单一真相是配置 txt(ConfigData 真实跑) 不是 UI 流。
- 红线守恒：ConfigData/JijieData 仍真实 import 真实跑（抽取内核零复刻），只复刻"赋 flag + 调 ConfigData 哪些方法 + 写 selected*"的编排顺序。

### B. select 屏全面实现（拆 5 件，按依赖序）
1. **jjbSession 全模式开局** = 把当前 toStartCore/toSelectCore 的 8/10/12 标准分支扩成 JijieContro 全分支：
   - InitPanel 9 handler → `startSession(mode)`：mode∈{f8,f10,f12,zhengjiu,suiji,feiqiu,onePickA,veryHard,veryHard2}(+蓝字/整活 框架留)；每 mode 设对应 flag 组合(见 InitPanel 真值)，再 toStart→toSelect。
   - toStartCore 补：极难/拯救早 toSelect 分支、mfc==4 末因子 getJijieFactor(hard,0)、modeZhenghuo/modeFeiqiu 锁定因子特例(随机/混乱工作室)。
   - toSelectCore 补：modeIsOnePick(指挥官设"自选")、拯救固定 7 人池、极难① A/B 整组赋值、modeIsVeryHard2 A6B3、modeSuiji countC=4、modeFeiqiu 删雷诺/斯台特曼、各 mfc 的 factorCount(随机因子数7/10/13/极难)+pop 特例、modeIsLanzi getFactorByScore、modeFeiqiu 固定3因子、nullFactorCount=mfc*3-2。
   - 验证：每 mode 的 randomFactorPoor.length === manualSlots(0)+1+2 之和（池=槽恒等式，JJBData 注释已给对账表 8=1/2/2,10=2/2/3,12=3/3/3,拯救=2/2/3,随机=0,非酋=1/1/1）。
2. **SelectScreen.tsx(新)** 承接 JJBSelect.ts 结构：topbar(lockup+player+mode) / 三场 slots(grid3：head+mapthumb+cmd槽+因子槽，锁定因子固定格带角标不可拖) / pool(左因子池 + 右 A/B 组 + 自选 18 格) / startbtn。布局照 select-screen.jsx(FX/CC/DropCell/CtrlBar/ToastV) — design-relative，70% DOM 白嫖。
3. **拖拽吸附**（React 承接 JJBSelect makeDraggable/checkHit）：
   - checkHit 语义=拖拽项左上锚 vs 槽热点 <30px(world)→命中。DOM 版用 getBoundingClientRect 中心/左上距 <阈值 判定，不需 cc.convertToWorldSpaceAR。
   - 库选型推荐：HTML5 原生 pointer 事件(pointerdown/move/up) 自写，不引 dnd-kit(避免 PoC 选型变量；吸附逻辑简单，~80 行)。fill→destroy 等价 = React setState slots[i]。
   - 状态：selection.slots[场]{cmds[],factors[]}，填槽 setSlot；live 同步写 JijieData.selectedCommanderList[场]/selectedFactorList[facFlatIdx(场,槽)]；点已填槽=清(clearTarget)。
4. **模式选择(home)**：home 6 模式(MODES) + 极难/单指/非酋等入口 → 各调 startSession(mode)。每 mode flag 组合见 InitPanel(已读全)。
5. **校验**（镜像 JJBSelect validate）：①每场指挥官未选 ②逐格因子未选(按 manualSlots(i) 槽数，禁按 length) ③B 组≤1(mfc>2 且非 onePick，按 groupMap 查 ConfigData.commanderList[name]→组别，A 池混入的 B 组也计)。不通过→toast(红框+条数)，__jjbDebug.select.error 保留。

### C. BP 整合并入 select（对接 bp-impl-spec §2.3 + r3 brief 5 交互）
- 流程：home 选模式 →〔⑤额外难度〕→ ①BP 面板(ban因子/自选指挥官 二选一弹层) →〔②ban页/③自选页〕→ 路径二选(手选/随机) → select(④每场点金) → battle。
- React 落点：BP 面板/ban页/自选页 = 弹层组件(沿用 current-dialog-pathchoice 遮罩骨架)，插在 startSession 之后、进 SelectScreen 之前。
- 数据层(H4)：ban→从 randomFactorPoor 移除该因子；BP 揉因子(J5)=抽 目标+banN 个进池(factorCount+=banN，需 jjbSession 支持)。点金(H1)=goldRuntime Set + toggleGold 重渲，×2 仅显示(Q1 计分挂起)。
- 依赖：①②③ 设计待 Claude Design r3 轮(brief 已备 design/v4-input-r2/r3-...md)；本段先把 select 主屏+全模式做实，BP 弹层留接口(startSession 已可接 banN/gold 参数)。

### D. 校验恒等式（交叉断言，每模式回归）
池=槽：randomFactorPoor.length === Σ manualSlots(i)；B 组≤1 触发条件 mfc>2 且非 onePick；9 格契约 selectedFactorList=new Array(9)；selectedCommanderList=[null,null,null] 起始。

### E. 逐屏迁移顺序 + harness phase（≥3）
- **Phase 0（已具雏形，补全）**：jjbSession 全模式开局 + 池=槽恒等式断言(纯逻辑，无 UI)。done：9 mode 各跑通、恒等式绿。
- **Phase 1**：SelectScreen.tsx 静态布局(三场+池+startbtn，读 sessionMatches，无拖拽) + 真实图对位(修 nameAsset：cmdRel/facRel/mapRel 指向 resources/images/{commander,factor,maps} 中文名 PNG，消除 design 占位 fallback 错位)。done：6 主题渲染对、真实地图名"聚铁成兵"配真实图、指挥官/因子图不重复。
- **Phase 2**：拖拽吸附 + 填/清槽 + live 写 JijieData + 校验 toast + __jjbDebug.select 同形。done：拖拽吸附手感对、校验三规则、Playwright select 回归绿。
- **Phase 3**：BP 整合(弹层②③ + 点金④ + 额外难度⑤ + 数据层 H1/H4/J5)，依赖 Claude Design r3 设计入库。
- **末**：全 9 模式真机 + select→battle 串联 + OBS 回归。

### F. 必修细节（本调研发现，根治）
- ①图 fallback 错位根因：web 用 design/v4-r2/assets 占位名(cmd-raynor.png/factor-void.png)，未对位真实中文名。真实图在 assets/resources/images/{maps,commander,factor,brand}(中文名 png，maps 30/commander 186/factor 164)。修 designAssets/nameAsset 或新建 resourceAsset.ts 用 import.meta.glob('../../../assets/resources/images/**/*.png') 按中文名直取。
- ②OBS 横条顶主题切换条：App.tsx switcher 在 ?bare 时已隐藏，但 ?screen=obs 仍渲 switcher → ObsScreen 应在 obsbar 形态强制 bare。
- ③__jjbDebug.obsbar 未单独透出：jjbSession.exposeBattleDebug 写死 screen='battle'，OBS 屏复用了它 → 需 exposeObsbarDebug 单独透 __jjbDebug.obsbar + screen='obsbar'。

---

## 段2 Phase 0 实施总结（全模式开局 · 纯逻辑）

> 2026-06-16 · 目标 lock-down：把 InitPanel 9 个 active 模式映射成 startSession(mode)，
> 逐模式复刻 JijieContro.toStart/toSelect 真实分支，使「池=槽恒等式」+「9 格契约」在 9 模式全绿。
> 这是 SelectScreen 的数据地基，第一弹信任建立弹。

### A. 改动文件（5 个，全在 web/src；红线 jijie2/Scene/design/resources 零改）
1. `web/src/logic/jjbSession.ts`（主）
   - 新增 `SessionMode` 类型（9 mode 名）+ `setModeFlags(mode)`（按 InitPanel.onClick* 真实 flag 组合设 JijieData 字段）
   - `toStartCore` 补全 4 个真实分支：modeIsVeryHard 早 toSelect + popMap("营救矿工") / modeIsZhengjiu 早 toSelect / mfc==2 popFactor 风暴/裂隙/部署 / 锁定因子特例（modeZhenghuo→"随机" / modeFeiqiu→"混乱工作室" / i==2 && mfc==4 → getJijieFactor(hard,0)）
   - `toSelectCore` 补全 11 个真实分支：modeIsOnePick / modeIsZhengjiu 固定 7 人 / 极难① A/B 整组 / 极难② A6B3 / modeSuiji 不 push 自选 / modeFeiqiu 删雷诺/斯台特曼 / 极难 jinanArr 4选2 强抽 / mfc==2 popFactor / mfc==4 拯救 popFactor / default onePick factorCount-- / 拯救 popFactor 风暴裂隙同化体 / modeIsLanzi getFactorByScore / modeFeiqiu 固定 3 因子 / nullFactorCount = mfc*3-2
   - `startSession(mode, opts?)` 入口（opts 预留 banN/gold 段2 BP 接口）+ `restoreConfig()`（每局重置 ConfigData 母池）+ `exposeSelectDebug` 透出 `__jjbDebug.select` + `exposeStartSession` 挂 `window.__jjb.startSession`
   - 旧 `startRandomSession` 兼容 BattleScreen 段1 PoC，逻辑保持
2. `web/src/App.tsx`
   - 新增 `?screen=phase0` 屏入口（Phase0Screen）—— 唯一作用=让 build 引用 startSession/exposeStartSession 防 tree-shake + 浏览器侧 e2e 入口（用 `window.__jjb.startSession(mode)` 切换模式）
3. `web/e2e/run.mjs`（重写）
   - 阶段 1：build 完整性 + bundle 标记符（9 mode 名 + 4 个真身字符串）
   - 阶段 2：Vite SSR + ssrLoadModule 加载 jjbSession.ts（零额外依赖，注入 globalThis.window shim），循环 9 模式调 startSession，读 `window.__jjbDebug.select` 断言池=槽恒等式 + 9 格契约 + status=2 + map=3 + lock=3 + manualSlots 镜像

### B. 9 模式真相表（paramMap 真值=5/7/9/7/0/3，池=槽恒等式全部成立）
| mode | mfc | flags | pool 实际 | manualSlots(0/1/2) | sum | identity |
|------|-----|-------|-----------|---------------------|-----|----------|
| std8 | 2 | — | 5 | 1/2/2 | 5 | ✓ |
| std10 | 3 | — | 7 | 2/2/3 | 7 | ✓ |
| std12 | 4 | — | 9 | 3/3/3 | 9 | ✓ |
| rescue | 3 | modeIsZhengjiu | 7 | 2/2/3 | 7 | ✓ |
| one-a | 3 | modeIsOnePick | 6 | 2/2/2 | 6 | ✓ |
| hard1 | 2 | modeIsVeryHard | 7 | 2/2/3 | 7 | ✓ |
| hard2 | 2 | modeIsVeryHard+modeIsVeryHard2 | 7 | 2/2/3 | 7 | ✓ |
| feiqiu | 1 | modeFeiqiu | 3 | 1/1/1 | 3 | ✓ |
| suiji | 0 | modeSuiji | 0 | 0/0/0 | 0 | ✓ |

### C. proof（已跑，原文）

**build**：
```
✓ built in 374ms
dist/assets/index-Bg1Px0Jb.js  209.64 kB │ gzip: 73.86 kB
```

**e2e**：
```
PASS: bundle contains all 16 markers

=== Phase 0 全模式开局断言 ===
mode    pool  manualSlots(0/1/2)  sum  identity  map  lock  selFacLen  selCmd  status  PASS/FAIL
std8       5                1/2/2    5         ✓    3     3          9       3       2  PASS
std10      7                2/2/3    7         ✓    3     3          9       3       2  PASS
std12      9                3/3/3    9         ✓    3     3          9       3       2  PASS
rescue     7                2/2/3    7         ✓    3     3          9       3       2  PASS
one-a      6                2/2/2    6         ✓    3     3          9       3       2  PASS
hard1      7                2/2/3    7         ✓    3     3          9       3       2  PASS
hard2      7                2/2/3    7         ✓    3     3          9       3       2  PASS
feiqiu     3                1/1/1    3         ✓    3     3          9       3       2  PASS
suiji      0                0/0/0    0         ✓    3     3          9       3       2  PASS

[react-e2e] ✅ 9 模式池=槽恒等式 + 9格契约 + 状态全 PASS
```

### D. done-when 逐条验证
1. ✅ startSession(mode) 覆盖 9 模式（std8/std10/std12/rescue/one-a/hard1/hard2/feiqiu/suiji）
2. ✅ 每模式池=槽恒等式：randomFactorPoor.length === manualSlots(0)+manualSlots(1)+manualSlots(2)
3. ✅ selectedFactorList 长 9 全 null、selectedCommanderList=[null,null,null]
4. ✅ 随机因子数 + manualSlots 逐值匹配对账表（5/7/9/7/6/0/3 + 1/2/2 等）
5. ✅ e2e 逐模式打印「mode/因子数/池长/Σ槽/PASS|FAIL」，全 PASS

### E. stop_when 边界
- 无 jijie2/Scene/design/resources 红线文件被改
- 9 mode 全跑通无异常
- 恒等式 9 mode 全成立（paramMap 真值与 manualSlots 真相表匹配）
- 无 manualSlots / ConfigData 字段路径与假设不符情况
- Dubhe 不可达：本次未走 Dubhe（e2e 用 Vite SSR 纯 Node 跑，零 Dubhe 依赖）

### F. 遗留 / 下一步
- Phase 0 信任建立完成，SelectScreen（Phase 1 静态布局 + Phase 2 拖拽校验）可启动
- BP 弹层（ban/点金/额外难度）→ Phase 3，依赖 Claude Design r3
- 双打模式走 JJBDoubles.start() 旁路，不在 startSession(mode) 9 模式内（与 dispatch contract 9 个 active 模式对齐——双打不在 9 中）
- startSession 接 banN/gold 参数（opts 预留，暂未启用）

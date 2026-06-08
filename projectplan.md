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

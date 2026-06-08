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

**harness gate（P3）— 阻于 reviewer 误警，按 stop_when 停下报告**：
- runVerify PASS（build exit 0）→ `review --phase 3` **mode=real、2 真 reviewer（gpt55+gemini-fl）**：7 rubric 中 6 PASS，**R4=WARNING**（gpt55），gate=**BLOCKED_WARNING**。
- R4 是 `builder.json startScene UUID` 校验——**非 P3 交付**（baseline 改动，P1 已 gate），且**客观误警**：`assets/Scene/danshua.fire.meta` 确含该 UUID、构建已成功构建该场景，reviewer 原话亦承认"build passed"，仅因 inlined 文本缺 .meta 映射而谨慎 WARNING。
- 根因：工作树全未提交 → phase-3 diff = 整个 P1–P3 未提交 diff，synthesize(glm-5.1) 起草的 rubric 漂到 baseline 文件（gitignore/builder/tryMount）而非 P3 拖拽码，且 evidence_source 悬空指向不存在的 `#/trace_summary/diff_snippet`。
- 未 record-gate、未 --force、未伪造签名。**待 hub 决策**：rubric 重新 scope 到 P3 拖拽 diff / 给 reviewer 补 .meta 证据 / 调 gate-policy。

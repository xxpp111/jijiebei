# 集结杯 · 六模式逐模式规则细则（R3 增量）

> 2026-06-17。第四步「6 模式细抠」汇总。可直接并入 `knowledge-base/claude-design-brief-r3.md`（接「五、与旧文档更新点」之后，作为「六、逐模式规则细则」）。
> 材料来源：mode-rules-truth-table.md / bp-impl-spec.md / rules-decisions.md 三套真相源 + 代码审计（jjbSession.ts、JijieContro.ts、JJBData.ts、JJBDoubles.ts）。
> **口径优先级**：凡 R3 brief 已覆盖处（每模式 BP 独立开关、12 因子=极难、selfShow 门控、随机=叠加层）以 R3 为准；材料中引用旧 bp-impl-spec「全局 all」「极难②」的表述已过时，本文按 R3 口径整理，差距保留在每节 ⑥ 与开放问题清单。
> 状态记号：✅已定 · ⏳已定待落地代码 · ❓待用户拍板 · ⚠️代码 bug。

口径约定（统一）：
- **屏显每场因子** = 锁定因子 1 + 手选槽（manualSlots）。
- **有效池 A11/B7** = A 组 12 / B 组 8 各清掉 1（凯瑞甘 / 凯拉克斯）后；ban 指挥官.txt 清空两行（⏳待配置同步）。
- **降权 0.25**（德哈卡 / 泰凯斯，B 组加权无放回）：作用域 = 标准 8/10/12 + 随机；**不含**拯救（hardcode 路径）/ 非酋（待定，见开放问题）/ 双打（独立骨架）。当前代码均为等概率 splice，⏳待落地 `pickWeightedIndex`。

---

## 1. 8 因子（std8，mfc=2）

| 维度 | 规则 |
|---|---|
| **① 因子** | base 2；屏显 2/3/3（锁定 1 + 手选 manualSlots 1/2/2）；母池 5。锁定因子 3 场各 1，`getJijieFactor(false)` 普通表，不命中末场特判。手选池循环 `getJijieFactor(false)` 抽 factorCount 次（=paramMap['随机因子数7']，实际值待查）。强制排除：风暴英雄 / 虚空裂隙 / 进攻部署，**额外 0.3 概率删同化体**（概率删，非必然）。smallRate=1（代码不传 smallRate，注释提及 0.9 疑死变量，无折扣生效）。 |
| **② 指挥官** | A 抽 4 / B 抽 2，无放回；有效池 A11/B7。降权 0.25 适用（⏳待落地）。selfShow=**true**。 |
| **③ 地图** | 3 场各随机 1，popMap 防重。mfc=2 约束：group 必须=2，或 33% 概率接受任意组。无特殊场名/删除。 |
| **④ BP** | R3 默认**开**，可调。形态 = 二选一（ban 1 因子 / 自选 1 指挥官，互斥）。无金框/点金（std8 不在 GOLD_FACTORS）。 |
| **⑤ 随机/自选** | 随机填充按钮 ✅；自选区 selfShow=true（从 selfPool 拖拽额外指挥官覆盖 A/B 随机）。二选一「自选 1 指挥官」与自选叠加层可能重合，受 BP 互斥决策影响。 |
| **⑥ 差距** | ⏳降权未落地（等概率 splice）；⏳ban 列表待清空；❓0.3 删同化体是否有意；❓paramMap['随机因子数7'] 实际值待查；❓smallRate 注释是否应删。 |

---

## 2. 10 因子（std10，mfc=3）

| 维度 | 规则 |
|---|---|
| **① 因子** | base 10；屏显 3/3/4（锁定 1 + 手选 2/2/3）；母池 7。锁定 3 场各 1，`getJijieFactor(false)`，不命中末场特判（mfc=3）。手选池无放回循环 7 次（factorCount=paramMap['随机因子数10']）。强制排除：**仅进攻部署**（保留风暴英雄/虚空裂隙/同化体，允许 3 维概率出现）。smallRate 同 std8 不传，等概率。 |
| **② 指挥官** | A 抽 4 / B 抽 2，无放回；有效池 A11/B7。降权 0.25 适用（⏳待落地）。selfShow=**true**（jjbSession.ts:200 `!modeSuiji && !modeFeiqiu` push 自选）。 |
| **③ 地图** | 3 场随机，mfc=3 倾向组 2（否则 0.33 概率任意组），popMap 防重。 |
| **④ BP** | R3 默认**开**，可调。二选一（modeIsOnePick 路径：自选 1 指挥官时 factorCount-- 从 7→6）。无末场强制大因子、无指挥官整组 hardcode。 |
| **⑤ 随机/自选** | 随机填充 ✅；自选区激活；modeIsOnePick 时自选 1 指挥官（3 场均可），手选因子数减 1。 |
| **⑥ 差距** | ⏳降权未落地；⚠️**mfc=3 三路合一**（10因子/拯救/单指共用 default 分支）但 popFactor 规则不同——拯救 pop 风暴/裂隙，10因子不 pop——代码未分支，归类隐含混淆（需澄清，见开放问题）；❓smallRate 参数传递缺失。 |

---

## 3. 极难 = 12 因子（std12，mfc=4）

> R3 已拍板：**12 因子 = 极难模式**，UI 合并、删「极难②」。本节即 R3 口径下的极难模式。

| 维度 | 规则 |
|---|---|
| **① 因子** | base 12；屏显 4/4/4（锁定 1 + 手选 3/3/3，与 10因子 3/2/3 不同）；母池 9。前两场普通表 `getJijieFactor(false)`；**末场强制大因子** `getJijieFactor(hard=true, smallRate=0)`（`i==count-1 && mfc==4` 特判，清零 group1~3 概率，仅 group4~6 生效）——这是核心特判。smallRate=1（全因子等权；区别 8因子注释 0.9）。强制排除：**仅进攻部署**（不删风暴/裂隙/同化体，区别 mfc<=3）。额外难度（Q2）：末场 +n（默认 2）→ manualSlots[2] 3→5（⏳待实装 H2）。 |
| **② 指挥官** | A 抽 4 / B 抽 2，无放回；有效池 A11/B7。降权 0.25 适用（⏳待落地）。selfShow=**true**。非拯救，不吃拯救 hardcode 7 人。 |
| **③ 地图** | 3 场随机无重复。mfc==4 特判：group **任意**可选（不限 group==2，绕过删除逻辑）；std12 本身不删地图。（注：modeIsVeryHard①=true && !modeIsVeryHard2 时额外 popMap 营救矿工——此为旧极难①双打路径，非 std12 主路径。） |
| **④ BP** | R3 默认**关，可手动开**（不锁死）。形态同二选一。金框×2 仅视觉、不入排名（Q1）。 |
| **⑤ 随机/自选** | home「随机」钮一键补全 3×3 因子（modeIsRandom 契约）；manualSlots 3/3/3（额外难度后 3/3/5）可手拖或被随机覆盖。9 格 null 契约固化（JijieContro.ts:300）。 |
| **⑥ 差距** | ⏳降权未落地；⚠️**JJBData.ts:107 manualSlots bug**：slotIdx==2 && modeIsVeryHard 时返 4（应返 3），末场槽数超 mfc，**需修**；⚠️代码三种"极难"（modeIsVeryHard/modeIsVeryHard2/feiqiu）都走 hard 抽取，与 R3「12因子=极难」单一口径的内部判定方式待澄清（见开放问题①）；❓8因子 smallRate；❓BP 是否适用 std12（R3=每模式开关，材料引旧「全局 all」已过时）。 |

---

## 4. 拯救（rescue，modeIsZhengjiu）

| 维度 | 规则 |
|---|---|
| **① 因子** | mfc=3，屏显 3/3/4（锁定 1 + 手选 2/2/3）；母池 7（沿用 10因子参数）。锁定 3 场各 1，`getJijieFactor(false)` 不命中末场特判。手选池构建：删风暴英雄 / 虚空裂隙 + **0.3 概率删同化体**，循环 push 7 个。smallRate=1。**早 toSelect**（toStartCore 内提前调 toSelectCore，✅与真相表一致）。 |
| **② 指挥官** | **硬编码固定 7 人，不走 A/B 分组、不读 CSV、绕过 ban**：雷诺、**凯瑞甘**、阿塔尼斯、斯旺、沃拉尊、斯图科夫、米拉。凯瑞甘**有意保留不吃 ban**（✅产品确认）。填 randomCommanderPoorA，B 为空。降权**不适用**（独立 hardcode 路径，已绕过）。selfShow=**false**（jjbSession.ts:502 `!modeIsZhengjiu`，不显示自选区）。 |
| **③ 地图** | 3 场随机，通用规则（mfc=3 等概率/组 2 倾向），不删风暴/裂隙/进攻部署。 |
| **④ BP** | R3 默认**关**，可调。**特殊**：7 人固定池无「自选指挥官」语义 → 若 BP 开启，二选一中「自选 1 指挥官」分支语义冲突（见开放问题④）。凯瑞甘不参与 ban 判定。 |
| **⑤ 随机/自选** | 随机填充从 7 人取 3、从 randomFactorPoor 填 3 因子槽；自选区隐藏（selfShow=false）。9 格契约已固化（startSession:300）。 |
| **⑥ 差距** | 因子/指挥官/地图/随机均**✅无差距**；❓0.3 删同化体是否有意；❓7 人如何映射到 3 场×指挥官槽（前端分配）；❓BP 启用时「自选指挥官」分支是禁用还是静默无效。 |

---

## 5. 官突 plus（doubles 双打）

> 独立前端骨架（JJBDoubles.ts），**旁路 XP**，不读 / 不写 JijieData；与 getJijieFactor / mfc / A-B 分组无关。

| 维度 | 规则 |
|---|---|
| **① 因子** | 每场 = 官突底 2（mutators=风暴英雄+虚空裂隙）+ 随机 3 = **5**（共 15/三场）。额外因子池：FACTOR_SOURCE 24 项删官突底 2 → 22 → shuffle → slice(0,9)（factorPoolSize=matches×extra=3×3）。无 lockFactorList，等效锁定=mutators 配置常量（三场相同）。无 popFactor。额外难度❌不适用。 |
| **② 指挥官** | COMMANDER_SOURCE **16 人扁平**（无 A/B 分组）→ shuffle → slice(0,6)（cmdPoolSize=matches×cmdsPerMatch=3×2）。每场 2 人（双方各 1）。无加权、无 ban 同步（凯瑞甘在池、不吃 ban，与拯救逻辑不同）。降权不适用。selfShow 不适用（纯 drag 选槽）。 |
| **③ 地图** | 赛前配置 DOUBLES_CONFIG.maps=[湮灭快车,克哈裂痕,往日神庙]，按索引直取，无随机重掷（长度<3 回落首项）。 |
| **④ BP** | **暂不启用**（Q6 拍板：暂不同步 ban/自选，先做主体、留框架后补）。bp-impl-spec J1~J5、金框、额外难度、排除配置全不适用。 |
| **⑤ 随机/自选** | 当前**无随机填充、无自选区**（16 人扁平池 + 9 因子补充池，纯 drag 进槽，setCommander/setFactor 写 selection.slots）。 |
| **⑥ 实装状态** | 骨架✅完成（start/reset/matches/判定 3 档 win/bonus）。差距：⚠️mutators+maps hardcode（建议移 DOUBLES_CONFIG 可配，Q10）；段 3④ Home→Select 入口**待实现**（当前 HomeScreen soon=true 拦截，jjbSession 无 startDoublesSession）；BP/降权/ban 框架预留未实装（Q6 暂不）。 |

---

## 6. 非酋（feiqiu，modeFeiqiu，mfc=1）

> **单刷实现**（沿用 XP jijie2 单刷链路：A/B 分组、popFactor、manualSlots），但 R3 brief 归「双打挑战」分类——分类与实现 mismatch，见开放问题②。

| 维度 | 规则 |
|---|---|
| **① 因子** | mfc=1；每场手选槽 1/1/1（manualSlots 恒返 1）；屏显每场 = 锁定 1 + 手选 1 = 2。因子池 = **3 个固定 hardcode**：风暴英雄、虚空裂隙、礼尚往来（jjbSession.ts:266-270，不走 getJijieFactor）。锁定因子 feiqiu 特判 = **混乱工作室**（每场）。popFactor：**不删进攻部署**（feiqiu skip，区别其他模式）。恒等式 poolLen(3)==sumSlots(1+1+1) ✅。 |
| **② 指挥官** | A 抽 4 / B 抽 2，有效池 A11/B7。**非酋特判**：删 A 组**雷诺** + 删 B 组**斯台特曼**（来源不明，见开放问题）。降权 0.25：当前不实装；落地时是否对非酋生效**待定**。selfShow=**false**（jjbSession.ts:502 `!modeFeiqiu`，不 push 自选、自选区不显示）。 |
| **③ 地图** | 3 场随机，通用逻辑，无模式特判。 |
| **④ BP** | R3=可配。形态二选一。**冲突**：selfShow=false 与 BP「自选 1 指挥官」逻辑冲突（见开放问题⑤）。 |
| **⑤ 随机/自选** | 随机填充适用（通用 fillSelectionSlots，因子池 3 个按 manualSlots 各 1 槽铺）；自选区 false；自选指挥官留待 BP 实装处理。validate B 组≤1 规则对非酋不生效（mfc=1≤2）。 |
| **⑥ 差距** | ❓非酋归类（MODES 数组缺席，InitPanel hardcode 入口）；❓3 固定因子来源（赛前配置 vs 每周 CSV）；❓删雷诺/斯台特曼意图（有意 vs PoC 遗留）；❓比赛结构（单人 vs 真双打）；❓selfShow=false 是否在 BP 自选形态时解除；❓不删进攻部署原因。 |

---

## 速查矩阵

| 模式 | mfc | 屏显因子 | 母池 | 指挥官 | selfShow | BP 默认(R3) | 降权 0.25 | 特殊 |
|---|---|---|---|---|---|---|---|---|
| 8 因子 | 2 | 2/3/3 | 5 | A4/B2(A11/B7) | true | 开 | 适用⏳ | 0.3删同化体 |
| 10 因子 | 3 | 3/3/4 | 7 | A4/B2(A11/B7) | true | 开 | 适用⏳ | 仅删进攻部署 |
| 极难=12 | 4 | 4/4/4 | 9 | A4/B2(A11/B7) | true | 关(可开) | 适用⏳ | 末场强制大因子+金框×2 |
| 拯救 | 3 | 3/3/4 | 7 | 固定7人(含凯瑞甘) | false | 关 | 不适用 | hardcode绕ban/早toSelect |
| 官突plus | — | 5/场(底2+随3) | 9池 | 16扁平→6 | — | 暂不 | 不适用 | 独立骨架/旁路XP |
| 非酋 | 1 | 1/1/1手选 | 3固定 | A4/B2删雷诺+斯台特曼 | false | 可配 | 待定 | 3固定因子/锁=混乱工作室 |

# 集结杯各模式规则真相表（供 yb 校对）

> 来源：research workflow `wfr2jeyti`（11 agent 并行测绘 jijie2 源码 + jjbDesign，2026-06-14）。
> 用途：**校对确认规则真相后，再据此翻译成后端代码改动**（前端我改、jijie2 给 yb patch）。
> 口径统一：屏显每场因子 = 锁定因子 1 + 手选槽（manualSlots）。下表"随机抽签每场因子"即屏显值，"手选每场槽"即 manualSlots 纯函数值（不含锁定）。
> 更新：2026-06-15 经 yb 确认，已定决策逐条落位——指挥官降权/ban 清空/BP 框架/金框/额外难度/排除等。已拍项标 ✅，待代码落地标 ⏳。
> ⚠️ **2026-06-19 R7 + KB审计 Phase A 重大更新**：双打已成真引擎、非酋之轮正名重定位、降权/ban清空/虚空重生者7 已落地 web 代码。下方旧表（2026-06-15 快照）与下面「0) 现状」节冲突处**一律以 0) 节为准**，旧表仅留历史对照。真相源已迁 `web/src/logic`（Cocos `assets/Script` 仅占位/回归只读）。

## 0) 2026-06-19 R7 现状（覆盖下方旧表冲突处）

**首页 8 格**（2026-07-02 更新，`web/src/config/modes.ts` MODE_DEFS 派生）：01 8因子(std8) / 02 10因子(std10) / 03 极难模式(std12) / 04 拯救(rescue) / **05 非酋之轮(feiqiu-doubles 双打)** / **06 官突双打(doubles)** / **07 15因子(std15 双打随机)** / **08 CM 专属(cm 双打)**。单打非酋(feiqiu)与老随机(suiji)已退出首页+URL白名单（仅 e2e 9 模式恒等式回归保留，玩家不可达）。

**四个双打变体**（web 真引擎 `web/src/logic/jjbDoubles.ts` per-variant 配置化 VARIANT_SPECS，commit f61ba0e；非 Cocos `JJBDoubles.ts` 占位）：

| 双打模式 | 锁定因子 | 玩家手填/可分配 | 地图 | 指挥官 |
|---|---|---|---|---|
| **官突双打**(doubles) | 每场按 A→B→C 档从 CSV 真表（`docs/官突ABC配置_官突池.csv`，易A51/中B57/难C32）各抽 1 官突，带 1~3 锁定因子 | 手填 3 随机因子（24 因子子集，排除当场锁定） | 官突自带真地图，每场不同（去重） | A 档抽 4 + B 档抽 2 = 6（COMMANDER_A 11人/COMMANDER_B 7人，源 `指挥官配置.txt` 第2列） |
| **非酋之轮**(feiqiu-doubles) | 每场只锁「混乱工作室」（1个） | 固定可分配池 3 个 {礼尚往来/风暴英雄/虚空裂隙}（玩家自由分配，非随机抽1） | 每场随机一张真地图（官突池去重地图集） | 同上 A4+B2=6 |
| **15因子双打**(std15，2026-07-02 yb 拍板) | 无锁定 | 每场 5 待选，候选池 17（15+2 余量），玩家自由分配 | 官方地图池（ConfigData.mapGrid）随机抽 3 去重 | A4+B2=6；自选区=官方全量减已入池（12 人）可拖入 |
| **CM 双打**(cm，2026-07-02 yb 拍板) | 每场固定锁「风暴英雄+虚空裂隙」2 个（不随机不分场） | 每场 4 待选（VARIANT_SPECS 可配 3-6 默认 4），候选池 14（12+2 余量） | 同 std15 官方地图抽 3 去重 | **3A3B**；CM 自制 4 人放 B 组与官方混抽 + 升权 2.0（`commanderWeight.ts`）；自选区=全部 22（官方18+CM4）减已入池（16 人） |

> 「飞球」=「非酋」同音（fēiqiú，非洲酋长梗），显示文案已全部正名「非酋」（jjbView `currentLockTag`/jjbDoubles `doublesModeLabel`）。

**Phase A 已落地代码**（KB审计 yb 2026-06-19 拍板，撤销下方"⏳待落地"）：
- **降权 0.25 ✅已实现**：德哈卡/泰凯斯 权重 0.25 加权无放回，单打（jjbSession B 组）+ 双打（jjbDoubles B 组），`web/src/logic/commanderWeight.ts`。统计 4000 局：德哈卡 0.27/泰凯斯 0.25（≈正常 1/4）。A 组无降权指挥官，保持等概率。
- **ban 清空 ✅已做**：`assets/resources/jjdata/ban指挥官.txt` 已清空 → 单打有效池 **A11/B7**（读 ConfigData）；双打硬编码本不读 ban。
- **虚空重生者=7 ✅已实现**：`FACTOR_SCORE_FALLBACKS` 5→7（单打难度分），撤销旧 5 分。

**真相源迁移**：主线 React/Vite（`web/`），规则逻辑落 `web/src/logic/{jjbSession(单打) / jjbDoubles(双打) / jjbView(门面) / bpConfig(BP门控) / commanderWeight(降权)}` + `web/src/data/mutatorPool(CSV烘焙)`。下方「4) 源码索引」指向的 `assets/Script` 为 Cocos 占位/回归只读，web 对应为真相。

---

## 1) 主表 <span>（⚠️ 旧 2026-06-15 快照，双打/随机/降权/ban 状态以上方 0) 节为准）</span>

| 模式 | 随机抽签每场因子（屏显=锁定1+手选） | 手选每场槽 manualSlots | 指挥官池 A抽/B抽（ban后有效池） | 锁定因子规则 | 关键特判 | 与已确认值对照 |
|---|---|---|---|---|---|---|
| **8因子**（标准, mfc=2） | 2/3/3（=1+ 1/2/2）；母池=5=1+2+2 | 1/2/2 | A抽4 / B抽2（**A11/B7**） | 每场1，共3，普通表 getJijieFactor(false) smallRate=1；不命中末场特判 | 因子池删风暴英雄/虚空裂隙/进攻部署，0.3 概率删同化体；smallRate=0.9 疑死变量（未传入母池循环） | ✅一致（因子 2/3/3、A11/B7、B出2/A出4）；✅德哈卡/泰凯斯降权0.25✅已实现(commanderWeight.ts) |
| **10因子**（标准/进阶, mfc=3） | 3/3/4（=1+ 2/2/3）；母池=7=2+2+3 | 2/2/3 | A抽4 / B抽2（**A11/B7**） | 每场1，共3，通用 getJijieFactor(false) smallRate=1；不命中末场特判 | popFactor(进攻部署)；smallRate=0.9；非拯救不删风暴/裂隙/同化体 | ✅一致（因子 3/3/4、A11/B7、B出2/A出4）；✅德哈卡/泰凯斯降权0.25✅已实现(commanderWeight.ts) |
| **12因子**（标准, mfc=4） | 4/4/4（=1+ 3/3/3）；母池=9=3+3+3 | 3/3/3 | A抽4 / B抽2（**A11/B7**） | 每场1，共3；**末场强制大因子**：i==末 && mfc==4 → getJijieFactor(hard, smallRate=0) 清零组1~3；前两场普通表 | 手选/随机抽取 smallRate=1（不设0.9，区别于8/10因子）；popFactor(进攻部署)；不删风暴/裂隙/同化体 | ✅一致（因子 4/4/4、A11/B7、B出2/A出4）；✅降权0.25全局加权✅已实现 |
| **拯救**（modeIsZhengjiu, mfc=3） | 3/3/4（=1+ 2/2/3）；母池=7 | 2/2/3 | **不适用**（hardcode 7人，不走A/B、不读CSV、绕过ban）：雷诺/凯瑞甘/阿塔尼斯/斯旺/沃拉尊/斯图科夫/米拉 | 每场1，共3，普通 getJijieFactor(false) smallRate=1（modeIsZhengjiu≠modeZhenghuo，锁定非"随机"） | **✅有意保留凯瑞甘**（不吃ban，已确认）；因子删风暴/裂隙+0.3删同化体；smallRate=0.9；不push自选 | ✅因子沿用10因子=3/3/4；✅凯瑞甘保留已确认有意；A/B池/降权不适用（hardcode 7人） |
| **随机模式**（⚠️**已下线**：suiji 移出首页+URL白名单，仅 e2e 9模式恒等式回归保留，玩家不可达） | — | — | — | — | — | 见 0) 节首页 6 格 |
| **双打**（⚠️**旧占位**，已被 0) 节 R7 真引擎取代，仅留历史） | ~~每场=官突底2（风暴英雄/虚空裂隙）+随机3=5~~ | — | ~~16人扁平洗牌取前6~~ → 现 A4+B2=6 | — | 见 0) 节 | ~~独立官突骨架~~ → R7 真引擎(CSV真表)；双打暂不同步BP ban |
| **极难②**（onClickHard2, mfc=2；**未上home**） | 不适用（不上home无前端随机抽签路径）；假设性接上=3/3/4（=1+2/2/3）；母池=7=2强抽+5hard | 2/2/3（modeIsVeryHard 覆盖，非标准8因子1/2/2） | **A抽6 / B抽3**（modeIsVeryHard2 覆盖默认4/2）；**A11/B7** + 自选 | 每场1，共3，**极难概率表** getJijieFactor(hard) smallRate=1；不命中末场特判（mfc=2≠4） | jinanArr 4选2 强抽（风暴英雄/虚空裂隙/给我死吧/虚空重生者，注释误写"6选2"）；极难表组5=0.45/组6=0.15；popMap(营救矿工) | ⚠️不符（产品确认值针对上home标准模式）：B抽3/A抽6 ≠ 标准B2/A4（极难②专属覆盖）；✅A11/B7、德哈卡/泰凯斯降权0.25⏳待落地；❓是否上home待土豆拍 |

---

## 2) ⚠️ 与产品已确认值冲突点（高亮）

| # | 模式 | 代码现状 | 已确认应为 | 差距 | 状态 |
|---|---|---|---|---|---|
| **C1** | **全单刷模式**（8/10/12/极难②/随机） | A/B 组抽样均为等概率无放回 splice（`Math.floor(random*len)`），全仓无 per-commander 权重/降权字段 | **德哈卡/泰凯斯权重 0.25（加权抽样）** | ✅**已实现**：未走"配置表加权列"，改为 `web/src/logic/commanderWeight.ts` 代码常量 + 加权无放回（B 组），单/双打共用 | ✅已实现 2026-06-19 |
| **C2** | **极难②** | countA=6 / countB=3（modeIsVeryHard2 覆盖） | 标准确认值 B出2 / A出4 | 极难②的 6/3 是专属覆盖，**不是 bug**，但产品确认值只覆盖上home标准模式 | ❓待定（极难②是否上home） |
| **C3** | **拯救模式** | hardcode 7人含凯瑞甘，绕过 ban 过滤 | 凯瑞甘有意保留 | 拯救保留凯瑞甘是**有意设计**，不是逃逸 bug | ✅已定 |
| **C4** | **双打模式** | COMMANDER_SOURCE 16人含凯瑞甘，不走 ban 过滤 | 暂不同步 ban | 双打独立骨架，暂不纳入 ban 同步范围 | ✅已定（Q6） |
| **C5** | **随机模式** | startRandom 取 allCmds 前3全是A组，B组2人被截断不出现 | B组出2 | 随机模式实际 B 组指挥官**不会出场**，与"B组出2"潜在冲突 | ❓待定 |
| **C6**（措辞） | **8因子** | A组定量抽4（countA=4） | 产品"A组随机若干" | 非不定量。确认"若干"即固定4 | ✅已定 |

---

## 3) ❓ 开放问题（待 yb 或土豆拍板）

| # | 问题 | 涉及模式 | 状态 |
|---|---|---|---|
| ~~**Q1**~~ | ~~泰凯斯·德哈卡"降权"是待实现需求，还是应在别处已存在但未测绘到？~~ | 8/10/12/极难② | ✅已定：权重 0.25，加权抽样 |
| **Q2** | **smallRate=0.9 在 8/10因子是否真生效？** | 8因子、10因子 | ❓待确认 |
| ~~**Q3**~~ | ~~拯救硬编码7人含被ban凯瑞甘，是有意保留还是漏改逃逸 bug？~~ | 拯救 | ✅已定：有意保留（不吃ban） |
| **Q4** | **拯救额外 pop 同化体只有 0.3 概率，是否有意设计、产品文档是否对齐？** | 拯救 | ❓待确认 |
| **Q5** | **拯救 7 人只填 randomCommanderPoorA、B为空，前端 7 人如何分配到 3 场×指挥官槽？** | 拯救 | ❓待确认 |
| ~~**Q6**~~ | ~~随机模式锁定因子物理抽取却全隐藏，是否确认随机模式就该完全无因子？~~ | 随机模式 | ✅已定：对齐 XP，期望行为 |
| **Q7** | **随机模式 B 组2人被截断不出场（见 C5），是否要保证 B 组指挥官出场？** | 随机模式 | ❓待定 |
| **Q8** | **极难②是否最终上 home？** | 极难② | ❓待土豆拍 |
| **Q9** | **jinanArr 注释写"6选2"但数组实为4项（4选2），是注释错还是漏配2个因子？** | 极难② | ❓待确认 |
| **Q10** | **双打"占位规则骨架"是否为终稿？** | 双打 | ✅**已结案（R7 真引擎）**：官突双打读 CSV 真表 A/B/C 抽签、非酋之轮混乱工作室+3可分配、指挥官 A4+B2，详见 0) 节。占位骨架已被 web/src/logic/jjbDoubles.ts 取代 |

### BP 框架已拍决策（2026-06-15 yb 全按推荐拍板）

> 来源：`rules-decisions.md` + `bp-impl-spec.md`，经 yb 确认。方向=配置驱动的两层框架：池层（决定什么进池）+ BP 层（抽出来后怎么 ban/pick）。赛制变只改配置、不动抽取内核。

| 编号 | 决策 | 详情 | 状态 |
|---|---|---|---|
| **BP①** | 因子**全量默认装配** | 自定义因子＝`因子配置.txt` 加行，抽取链零改动 | ✅已定 |
| **BP②** | 排除＝**只排单因子** | `popFactor` 配置化读排除名单，不做排除组合 | ✅已定 |
| **BP③** | 金框/点金（CM 特色玩法） | 赛前固定金框名单 + 选手每场「点金」交互；软件作用＝**分值×2 仅视觉显示、不进排名**（主计分=场数，因子分值本就不入排名）；抽取概率不变 | ✅已定 |
| **BP④** | 指挥官降权 | 德哈卡/泰凯斯**权重 0.25**（≈正常出场 1/4）；ban 清掉凯拉克斯/凯瑞甘→有效池 **A11/B7** | ✅**已实现**（降权=commanderWeight.ts 单/双打 B 组；ban 已清空 ban指挥官.txt）2026-06-19 |
| **BP⑤** | 拯救保留凯瑞甘 | 固定 7 人含凯瑞甘，**不吃 ban**（有意设计） | ✅已定 |
| **BP⑥** | BP 当前＝**ban 1 因子 _或_ 自选 1 指挥官（二选一）** | 框架可配，当前先上二选一主形态 | ✅已定 |
| **BP⑦** | 额外难度 | 开关 + n 可配（默认 n=2），**末场 +n** 因子 | ✅已定 |
| **BP⑧** | 虚空重生者补分值 | **7**（参照同组类型 5） | ✅**已实现**（FACTOR_SCORE_FALLBACKS=7）2026-06-19 |
| **BP⑨** | 双打暂不同步 ban | 留作可配选项后补 | ✅已定（Q6） |
| **BP⑩** | 额外难度/BP 适用范围 | **本期全局 all，不分模式** | ✅已定 |
| **BP⑪** | 威望（Prestige）暂不纳入 | 回归杯资源组的威望分类暂不管 | ✅已定 |

---

## 4) 📌 关键源码索引

**因子抽取核心**
- `assets/Script/jjbDesign/JJBData.ts:88-115`（FAC_PER_MATCH:88 / facFlatIdx:89 / manualSlots:96-115 / 对账表注释:94）
- `assets/Script/jjbDesign/JJBData.ts:127-134`（sessionMatches 锁定透出；:133 modeSuiji 隐藏 lock）
- `assets/Script/jjbDesign/JJBDesignBoot.ts:324-360`（startRandom；填槽循环:345-350；屏显注释:341-343）
- `assets/Script/jijie2/JijieContro.ts:91-105`（toStart 锁定因子循环 count=3；:98-99 12因子末场 smallRate=0）
- `assets/Script/jijie2/JijieContro.ts:198-263`（因子母池构建：8因子:211-220 / 10因子:232-245 / 12因子:221-229 / 极难:199-210 / modeSuiji:230-231；getJijieFactor 母池循环:259-263）
- `assets/Script/jijie2/data/JJConfigData.ts:150-167`（getJijieFactor 拒绝采样；:154 极难概率表；:155-157 仅组1~3吃 smallRate）
- `assets/Script/jijie2/JijieData.ts:15,80`（lockFactorList）/ `:37,81`（randomFactorPoor）

**指挥官抽取核心**
- `assets/Script/jijie2/JijieContro.ts:113-187`（toSelect 指挥官主体）
- `assets/Script/jijie2/JijieContro.ts:134-143`（countA/countB：默认4/2；极难2→6/3；modeSuiji→countC=4 死代码）
- `assets/Script/jijie2/JijieContro.ts:154-171`（A/B 无放回 splice 抽取）
- `assets/Script/jijie2/JijieContro.ts:129-132`（纯极难取整A/B组）/ `:120-127`（拯救 hardcode 7人，:122 push凯瑞甘）/ `:116-119`（onePick 全设自选）/ `:150-153,162-165`（非酋删雷诺/斯台特曼）/ `:181-183`（自选格门控）
- `assets/Script/jijie2/data/JJConfigData.ts:38-66`（ban splice）
- `assets/resources/jjdata/指挥官配置.txt:2-19`（真实CSV；德哈卡=B:14 / 泰凯斯=B:16）
- `assets/resources/jjdata/ban指挥官.txt:2-3`（凯拉克斯、凯瑞甘 → 已定清空）
- ⚠️误导源 `assets/Script/jjbDesign/JJBData.ts:43-46`（GROUP_A/B/POOL 硬编码 demo 占位，不参与真实抽取）

**模式分派 / 入口**
- `assets/Script/jijie2/view/InitPanel.ts`（onClick2:55 / onClick3:64 / onClick13:73 / onClick4拯救:82 / onClickSuiji:165 / onClickHard:92 / onClickHard2:100）
- `assets/Script/jjbDesign/JJBData.ts:19-27`（MODES 6项；:26 极难不上home注释）
- `assets/Script/jjbDesign/JJBDesignBoot.ts:262`（handlers 分派表5项）/ `:243-246`（i===5→startDoubles 旁路XP）

**双打**
- `assets/Script/jjbDesign/JJBDoubles.ts:5-26`（DOUBLES_CONFIG / FACTOR_SOURCE 24项 / COMMANDER_SOURCE 16人含凯瑞甘:24）
- `assets/Script/jjbDesign/JJBDoubles.ts:63-79`（start: filter mutators+shuffle 取池）/ `:124-134`（三档判定）/ `:136-158`（matches: 场名/地图/官突lock）
- `assets/Script/jjbDesign/JJBDesignBoot.ts:438-441`（控制条 gating 走 doubles.live/totalCount）

**数据真相源绑定证据**
- `assets/Scene/danshua.fire:22083-22087`（commanderTxt→指挥官配置.txt、commandeBanTxt→ban指挥官.txt）
- `settings/project.json:26` + `settings/builder.json:10`（start-scene=danshua.fire）
- `assets/resources/jjdata/规则参数配置.txt:2-19`（A4/B2、随机因子数、组概率）

**BP 框架配置** ⚠️（下列多为 2026-06-15 设想的"配置表驱动"方案；实际 R7 落地走了不同路径，以 0) 节为准）
- ✅**已实现，但非配置表路径**：降权=`web/src/logic/commanderWeight.ts` 代码常量（非 `指挥官配置.txt` 加权重列）；虚空重生者=7 走 `jjbSession.ts FACTOR_SCORE_FALLBACKS`（非 `因子配置.txt` 加列）；ban 清空=`ban指挥官.txt` 已空表头 → A11/B7。
- ⏳**仍未落地**：金框分值倍率配置 / 因子排除.txt / 金框因子.txt / BP规则.txt / 额外难度末场+n（opts.banN 仅占位）。BP 现实=`bpConfig.ts` 按模式门控（std8/10开·std12/拯救/非酋可开·doubles锁死），与旧"全局 all 不分模式"口径不同。
- `assets/resources/jjdata/因子配置.txt`（旧设想：加列金框分值倍率；第30行虚空重生者补分值=7）→ 实际走 jjbSession fallback
- `assets/resources/jjdata/指挥官配置.txt`（加列：权重；德哈卡/泰凯斯=0.25）
- `assets/resources/jjdata/ban指挥官.txt`（清空→A11/B7）
- `assets/resources/jjdata/规则参数配置.txt`（加行：额外难度开关/n、金框分值倍率）
- `assets/resources/jjdata/因子排除.txt`（new：排除单因子）
- `assets/resources/jjdata/金框因子.txt`（new：赛前固定金框+点金门控）
- `assets/resources/jjdata/BP规则.txt`（new：BP参数）

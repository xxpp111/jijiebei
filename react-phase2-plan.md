所有关键事实已与代码核对完毕，调研描述与现状一致（仅 App.tsx 行号有出入，obs 分支确已是 `<ObsScreen/>{switcher}`，bare 机制已生效）。三份调研自洽，无矛盾点需要再澄清。下面给出综合规划。

---

# 集结杯 React 迁移 · 整理 + 组件库化 + 段2 实现 综合规划

写给没看过调研过程的读者，完整句子、不用代号。已用代码核对，标注的行为均为实测现状，非记忆。

---

## 第一部分 · 整理执行清单（hub 直接做，低风险，本 workflow 后续可立即落地）

这一部分是"根治已知细节问题"，三件事都已定位到具体文件和行，改动面小，不碰红线逻辑。

### 任务 1.1 — 真实图映射根治（解决图 fallback 错位，最重要）

**问题本质**：`web/src/lib/nameAsset.ts` 是有损映射层。它把真实中文名映射到 design 目录下仅 21 张示例图，且指挥官、因子各只硬编码 6 条，地图按场次序号在 3 张示例图里循环。结果是：真实数据里出现「沃拉尊」「斯台特曼」时全部画成雷诺（指挥官重复占位），地图缩略图永远显示「克哈裂痕／黑暗杀星／往日神庙」的艺术字，而旁边的地图名文字却是真实的「聚铁成兵」，图文不符。

**根治方案**（与 Cocos 真身同源，不是补映射表而是删掉它）：
- 新建 `web/src/lib/realAsset.ts`，用 `import.meta.glob('../../../assets/resources/images/**/*.png', { eager:true, query:'?url', import:'default' })` 把真实游戏图整批编译成 URL 表，按中文名 basename 直接命中。这与现有 `designAssets.ts`、`jjbSession.ts` 已验证可用的 `../../../assets/resources/...` glob 同款，Vite 的 `server.fs.allow` 已含仓库根，构建期捆绑，无运行时请求。
- 导出 `mapUrl(name)`、`cmdUrl(name)`、`facUrl(name)`、`logoUrl(style,mode)`。其中 `logoUrl` 固定返回 `brand/logo-cm-gold.png`（对齐 `JJBData.markFor` 的「全皮肤统一金色浮雕」决策），但保留 `style/mode` 入参签名供将来分皮肤。
- 找不到时返回空串（不显示破图），比错图更诚实；可加一行 `console.warn` 便于发现漏名。实测真实图目录齐备（地图 15、指挥官 93、因子 82、品牌 15），中文名逐字对齐 `JijieData` 输出，命中率应为 100%。

**改三个调用点**（删 `nameAsset.ts` 的 design 映射，改调 realAsset）：
- `web/src/components/ObsBar.tsx`：第 54 行地图从 `dz(mapRelByIdx(row.idx))` 改成 `mapUrl(row.mapName)`（关键，去掉序号循环）；第 61 行 `cmdRel(c)` 改 `cmdUrl(c)`；第 66 行 `facRel(f)` 改 `facUrl(f)`；第 75 行 `dz(logoRel(...))` 改 `logoUrl(style,mode)`。
- `web/src/components/MatchRow.tsx`：与 ObsBar 同源 API，三处资产调用同样换真实查表。
- `web/src/screens/BattleScreen.tsx`：logo 调用改走 `logoUrl`。

**`designAssets.ts` 的处置**：`dz()` 收窄职责到只供「边框／装饰类 design 资产」（即 `FactorFrame` 的 `border-factor-*.png`），所有内容图（地图／立绘／因子／logo）全走 realAsset。`nameAsset.ts` 整体删除。

**验证**：访问 `?screen=battle` 与 `?screen=obs`，地图缩略图显示「聚铁成兵」真实图（图文一致），指挥官与因子不再重复占位。

### 任务 1.2 — OBS 横条 bare + obsbar debug 透出（解决问题②③）

**问题② 现状**：`App.tsx` 的 `switcher` 已受 `?bare=1` 控制（第 19、23 行），obs 分支当前是 `<ObsScreen/>{switcher}`（第 45-46 行），所以带 `?bare=1` 时切换条已不出现，机制其实已通。**硬化建议**：OBS 横条是对外直播产物，让它默认就不挂切换条——把 obs 分支改成只渲染 `<ObsScreen style mode/>`，不传 `{switcher}`。这是一行删除、零风险，主题切换在 obs 屏改由 URL `?style=&mode=` 控制。

**问题③ 现状与根因**：`jjbSession.exposeBattleDebug()` 第 178 行硬写 `w.__jjbDebug.screen = 'battle'`，并把数据塞进 `__jjbDebug.battle`。ObsScreen 复用了 battle 的 debug，没有独立的 `obsbar` 键，于是 jjb-verify 的 obsbar 回归读 `__jjbDebug.obsbar` 必为 undefined，会挂。**根治**：
- 在 `jjbSession.ts` 新增 `exposeObsbarDebug(wins, total)`，与 `exposeBattleDebug` 并列，写 `screen='obsbar'` 和 `__jjbDebug.obsbar = { matches, wins, total, rows }`，其中 rows 的 status/verdict 编排与 ObsScreen 渲染同形。
- 在 `ObsScreen.tsx` 算出 rows/wins 后调用它。注意顺序：`startRandomSession(2)` 内部会先把 screen 写成 battle，所以 `exposeObsbarDebug` 必须在其后执行以覆盖 screen 为 obsbar。建议放在组件主体每次渲染都覆盖，确保 obs 屏 screen 恒为 obsbar。
- 顺手抽一个 `obsRowStatus(i)` 工具函数，让 ObsScreen 渲染的 status 编排与 exposeObsbarDebug 的 rows 编排共用，避免 debug 与渲染漂移（jjb-verify 断言纪律要求二者一致）。
- `total` 现写死 3，标 TODO 改用 `matches.length`（当前固定 3 含 BOSS 场，暂可）。

**验证**：`?screen=obs&bare=1` 无切换条；浏览器 `window.__jjbDebug.obsbar` 存在且 `screen==='obsbar'`；jjb-verify 的 obsbar 回归绿。

### 任务 1.3 — web 结构小整理

- 删 `nameAsset.ts`（被 realAsset 取代）。
- `designAssets.ts` 加注释划清边界（仅边框装饰），或重命名为 `frameAsset.ts` 表意。
- `logoUrl/logoRel` 的 style/mode 入参保留不动（未来分皮肤预留），加注释即可，不要为单分支删参数。

**不动的红线**：`logic/jjbSession.ts` 的 toStart/toSelect 复刻逻辑、`@logic`/`@jjb` alias、`cc-shim.ts`、6 主题 CSS。本轮整理不碰。

---

## 第二部分 · 组件库化 + 对接 Claude Design

**Claude Design 真相修正（已实测确认）**：当前登录唯一可写项目是 `Design System` = `846279a0-f6a9-4ee2-905c-cdaae7949407`。projectplan 反复引用的 `b4fe41ec` 不在可写列表、当前登录不可达。**同步目标改为 846279a0**，推送前先 `get_project` 确认它是 `PROJECT_TYPE_DESIGN_SYSTEM` 类型（该类型创建即固定不可改）。

**同源关系**：web 的 `.tsx` 真身与 `design/v4-r2/components/*.jsx` 设计稿是 1:1 克隆（FactorFrame=FX、CommanderCard=CC、MatchRow、ObsBar，props 名与 className 几乎逐字一致，共吃同一份 `design/v4-r2/*.css`）。因此同步方向是 **web 真身上行收编 design 设计稿**：把真组件 build 成 design-system，Claude Design 出新稿时直接 import 真 React 组件，未来不再需要 jsx→tsx 翻译。

**目录结构**：在 web 内新建 `web/src/ui/`，一组件一目录，每个目录四件套：`X.tsx`（纯展示、props 驱动、不 import 业务 logic）、`X.types.ts`（props 接口 + 每个 prop 一行中文注释）、`preview.tsx`（首行 `<!-- @dsCard group="..." -->` + 渲染全变体矩阵）、`README.md`（定位 + props 表 + 用例 + 对应 Cocos 真身）。加 vite alias `@ui → src/ui`，screen 层改 import 指向 `@ui`，真身只留一份。

**props 契约补全**：FactorFrame 与 CommanderCard 要补 design jsx 有、tsx 漏的 `clearHover`（清槽 hover 态，select 屏要用）。MatchRow 内联的判定按钮提为 primitive `VBtn`，ObsBar 内联徽章提为 primitive `ObsBadge`。

**图源升级**：组件 props 从「design-relative path」升级为「传 URL」——组件库不该知道图怎么来，screen/preview 层用 realAsset 算好 URL 传入。这让组件对真实图与占位图都通用。

**preview 变体矩阵**：FactorFrame（normal/gold/sel+check/锁定/官突/dim/drag/ghost）、CommanderCard（default/sel+check/fill/drag/ghost/noName）、MatchRow（done-win/live/wait/boss + 判定按钮 on/off）、ObsBar（6 主题 × 进行中局/全判定局，这是缩放可读性验收卡）。card group：Factors / Commanders / Match / OBS / Primitives。

**同步动作**：`get_project 846279a0` 验类型 → `list_files` 看远端现状 → `finalize_plan`(writes=`ui_kits/jjb/**`, localDir=`web/src/ui`) → `write_files` 推 preview + 源。单向上行，每次改组件后 `/design-sync` 增量推单组件，永不整体替换。

> 注意：组件库化依赖任务 1.1（图源根治）先完成——只有组件吃真实图，design-sync 出来的稿才有真实协作价值。

---

## 第三部分 · 段2 全面实现蓝图（下一个 goal 派发用）

目标：结合 TS 逻辑全面实现 select 屏的选因子、模式选择、随机逻辑、全模式。

### cc-shim 完整化 vs 剥离 —— 推荐【按需复刻 jjbSession，不原样 import JijieControl】

原样 import `JijieControl` 的代价：它第 2 行 `import JJUI`（cc.Component），toStart/toSelect 末尾调 `this.jjUI.updateToStart/updateToSelect`（UI 副作用），onClick* 在 InitPanel（cc.Component，带 @property EditBox/Node）。原样引入需要桩 cc.Component / EditBox / Node / _decorator + jjUI 约 15 个方法，膨胀数百行，违背 200KB 瘦身动机。复刻成本（赋 flag + 调 ConfigData + 写 selected*，UI 调用是叶子可弃）远低于 shim 成本，且抽取内核仍让 ConfigData/JijieData 真实跑、零复刻。**结论：继续按需复刻 jjbSession，cc-shim 只保留 log/warn/error，不补全。**

### select 屏全面实现（5 件，依赖序）

1. **jjbSession 全模式开局**：把 InitPanel 的 9 个 handler 映射成 `startSession(mode)`，每个 mode 设对应 flag 组合，跑通 toStart→toSelect 全分支。当前缺口：现仅 `startRandomSession(2)` 一局 8 因子，toStartCore/toSelectCore 只复刻 8/10/12 标准分支。需补：极难/拯救的早 toSelect、`mfc==4` 末因子取 `getJijieFactor(hard,0)`、整活随机/非酋混乱工作室的锁定特例、拯救固定 7 人、极难①整组、极难②A6B3、各 mfc 的 factorCount 与 pop 特例、`nullFactorCount = mfc*3-2`。

2. **SelectScreen.tsx**：承接 JJBSelect 结构（顶栏 / 三场 grid3：head+地图缩略+指挥官槽+因子槽，锁定因子固定格带角标不可拖 / 因子池：左因子+右 A/B 组+自选 18 格 / 开始按钮），照 `design/v4-r2/components/select-screen.jsx`（FX/CC/DropCell/CtrlBar/ToastV）复用约 70% DOM。

3. **拖拽吸附**：React 承接 Cocos 的 `makeDraggable`。**推荐 HTML5 原生 pointer 事件自写（约 80 行），不引 dnd-kit**（避免 PoC 引入选型变量）。DOM 版用 `getBoundingClientRect` 距离 < 阈值判定，替代 Cocos 的 `checkHit < 30px`（world 坐标）。状态用 `selection.slots[场]{cmds,factors}` setState；live 同步写 `JijieData.selectedCommanderList[场]` / `selectedFactorList[facFlatIdx(场,槽)]`；点已填槽即清。

4. **模式选择**：home 6 模式（MODES）+ 极难/单指/非酋入口 → `startSession(mode)`。

5. **校验**（镜像 JJBSelect validate 三规则）：① 每场指挥官未选 → 拦；② 逐格因子按 `manualSlots(i)` 槽数判（**禁止按 length/null 计数**）；③ B 组指挥官 ≤ 1（mfc>2 且非 onePick 时生效，按 `ConfigData.commanderList[name]→组别` 查表，A 池混入的 B 组也要计）。不通过 toast，`__jjbDebug.select.error` 保留。

### BP 整合（并入 select）

流程：home 选模式 →〔额外难度⑤〕→ BP 面板①（ban 因子／自选指挥官 二选一弹层）→〔ban 页②／自选页③〕→ select（每场点金④）→ battle。React 实现为弹层组件（沿用 current-dialog-pathchoice 遮罩），插在 startSession 后、进 SelectScreen 前。数据层：ban → 从 `randomFactorPoor` 移除（规则 H4）；揉因子 `factorCount += banN`（J5）；点金 goldRuntime Set + ×2 仅显示（Q1 计分挂起）。**①②③ 的视觉设计待 Claude Design r3 轮**（brief 已备 `design/v4-input-r2/r3-bp-pointgold-difficulty-brief.md`）。**本段先做实 select 主屏 + 全模式，BP 弹层留接口**（startSession 接 banN/gold 参数）。

### 校验恒等式（交叉断言，给 harness done-when 用）

- **池=槽恒等式**：`randomFactorPoor.length === Σ manualSlots(i)`（i=0..2）。
- B 组 ≤1 仅在 mfc>2 且非 onePick 触发。
- 9 格契约：`selectedFactorList = new Array(9).fill(null)`；`selectedCommanderList = [null,null,null]`。
- 载入关键事实（exact）：随机因子数 7/10/13/极难=5/7/9/7；A 组指挥官 4、B 组 2；`nullFactorCount=mfc*3-2`；checkHit 阈值 <30px；manualSlots 对账表 8=1/2/2、10=2/2/3、12=3/3/3、拯救=2/2/3、随机=0/0/0、非酋=1/1/1。

### 逐屏顺序 + harness phase（≥3）

- **Phase 0**：jjbSession 全模式开局 + 池=槽恒等式断言（纯逻辑，无 UI）。done：9 mode 跑通、恒等式绿。
- **Phase 1**：SelectScreen 静态布局（读 sessionMatches，无拖拽）+ 真实图对位（即第一部分任务 1.1）。done：6 主题渲染对、「聚铁成兵」配真实图、图不重复。
- **Phase 2**：拖拽吸附 + 填/清槽 + live 写 JijieData + 校验 toast + `__jjbDebug.select` 同形。done：吸附手感对、三规则、Playwright select 回归绿。
- **Phase 3**：BP 整合（弹层②③ + 点金④ + 难度⑤ + 数据层 H1/H4/J5），依赖 Claude Design r3 入库。
- **末**：全 9 模式真机 + select→battle 串联 + OBS 回归。

### 红线边界与风险

- **红线（只读 import，零改）**：`assets/Script/jijie2/*`、`assets/Script/Scene/*`、`design/*`、`assets/resources/*`。select 逻辑通过 `@logic` alias 调真实 ConfigData/JijieData，不复制其源。
- **风险**：① 拖拽手感（world 坐标 30px 阈值 → DOM rect 距离）需真机对照调，建议 Phase 2 截图比对；② B 组查表依赖 `ConfigData.commanderList` 组别字段，派发前需 spoke 确认该字段路径；③ BP 弹层视觉阻塞在 Claude Design r3，Phase 3 不可先于设计入库启动，故 Phase 0-2 与 Phase 3 解耦。

---

## 第四部分 · 上下文包

### 关键文件路径（绝对）

- 真身组件：`/Users/bytedance/项目/jijiebei/web/src/components/{FactorFrame,CommanderCard,MatchRow,ObsBar}.tsx`
- 图源待重写：`/Users/bytedance/项目/jijiebei/web/src/lib/{designAssets,nameAsset}.ts`（新建 `realAsset.ts`）
- screen 接缝 + debug：`/Users/bytedance/项目/jijiebei/web/src/{App.tsx,screens/BattleScreen.tsx,screens/ObsScreen.tsx,logic/jjbSession.ts,cc-shim.ts}`
- 真实游戏图（中文名 PNG，只读 glob）：`/Users/bytedance/项目/jijiebei/assets/resources/images/{maps,commander,factor,brand}/*.png`
- 逻辑源（红线只读）：`/Users/bytedance/项目/jijiebei/assets/Script/jijie2/{JijieContro.ts,JijieData.ts,view/InitPanel.ts,view/SelectPanel.ts,data/JJConfigData.ts}`
- 桥（复用）：`/Users/bytedance/项目/jijiebei/assets/Script/jjbDesign/{JJBData.ts,JJBSelect.ts}`
- 设计稿源：`/Users/bytedance/项目/jijiebei/design/v4-r2/components/select-screen.jsx`
- BP 规则：`/Users/bytedance/项目/jijiebei/knowledge-base/bp-impl-spec.md` + `rules-decisions.md`；r3 brief：`/Users/bytedance/项目/jijiebei/design/v4-input-r2/r3-bp-pointgold-difficulty-brief.md`
- build/alias：`/Users/bytedance/项目/jijiebei/web/{vite.config.ts,tsconfig.json}`

### XP / debug 接口面增量

- 新增 `exposeObsbarDebug(wins,total)` → `__jjbDebug.obsbar = { screen:'obsbar', matches, wins, total, rows }`。
- 新增 `__jjbDebug.select = { slots, error, randomFactorPoorLen, manualSlots[] }`（select 屏渲染后透出，供 Playwright 校验池=槽恒等式与三规则）。
- 新增 `startSession(mode, opts?)`，opts 预留 `{ banN, gold }` 接 BP。

### 第一个 goal 的 done-when（Phase 0，纯逻辑无 UI，可立即派）

1. `jjbSession.startSession(mode)` 覆盖 9 个模式（标准 8/10/12、拯救、单指、极难①、极难②、随机、非酋），每个 mode 跑通 toStart→toSelect 全分支。
2. 每个 mode 下 `randomFactorPoor.length === Σ manualSlots(i)`（i=0..2）成立。
3. `selectedFactorList` 长度 9 全 null、`selectedCommanderList` 为 `[null,null,null]`。
4. 随机因子数与 manualSlots 对账表逐值匹配（7/10/13/极难5/7/9；8=1/2/2、10=2/2/3、12=3/3/3、拯救=2/2/3、随机=0/0/0、非酋=1/1/1）。
5. stop-and-report-if：发现某 mode 的 ConfigData 字段路径与复刻假设不符，或恒等式不成立且非测试数据问题，停下报告而非强改红线。

**三份调研自洽，与代码现状核对一致，可据此直接整理（第一部分 hub 可立即做）并派发段2 goal（第三部分 Phase 0 为第一弹）。唯一需修正的 projectplan 既有记载：Claude Design 同步目标从 `b4fe41ec` 改为 `846279a0-f6a9-4ee2-905c-cdaae7949407`。**

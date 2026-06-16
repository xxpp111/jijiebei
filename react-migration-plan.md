# 集结杯前端 Cocos → React 迁移规划

> 2026-06-16 · hub 综合 workflow `wf_08469258`（4 视角调研 synth 卡限流，hub 接手综合）。
> 决策动机：①Cocos cc.Graphics 复刻 CSS 设计精致度对不上 ②canvas 文字 blur ③想和 Claude Design HTML/React 稿 1:1 直连 ④design-sync 组件库从「影子」变「真身」、翻译那步消失。
> 与当前 Cocos 线（BP 整合、jijie2 ban 强版 patch）**并行**推进，独立 harness-pro round。

## 0. 一句话结论

这个工程的 React-readiness 远超典型 Cocos 项目：**逻辑层已是纯 TS 库**（`JijieData`/`JJConfigData` cc.*=0）、**设计稿已是 React 组件**（`design/v4-r2/components/*.jsx`）、**桥层已 0 耦合**（`JJBData.sessionMatches/manualSlots/jjbLive`）。迁移本质 = 把 `JJBView` 的 cc.Graphics 画笔换成 React 组件，**不是重写**。顺带根治 blur（动机②③）、包体 2.5MB→~200KB（=老问题「加载慢」根源之一）、Claude Design 稿 1:1 直连（动机①④）。

---

## 第一步：项目文件/目录规范化清理（hub 执行，迁移前先做干净）

**现状判断**：核心干净——`jijie2`/`data`/`Scene`/`ConfigData` git 全 clean；噪音集中在「根目录散落调试 PNG」+「未 tracked 又未 ignore 的内容目录」（`git add .` 会误入库的最大风险）。

**直接做（零风险）**：
- 删根目录调试图：`jjb-sharpen-bp-A/B/none.png`、`jjb-sharpen-home-1600x1000.png`（本 session 验证产物）。
- 补 `.gitignore`：`/jjb-sharpen-*.png`、`/kb-whiteboards/`、`/diagrams/**/crop_*.png`、`/diagrams/**/err.log`。
- ⚠️勘误（来自 synth）：`.gitignore` **已 ignore** `/.claude/` `/.harness-pro*` `/config/` `/scripts/` `/build/` `/library/` `.playwright-mcp/` —— 别重复建议。
- 改名/重写：根 `README.md` 现在是 `hello-world` Cocos 模板残留，重写为集结杯说明（指向 projectplan / design / knowledge-base）。
- 归档：`design/v1 v2 v3 v4-input` → `design/_archive/`，保留 `v4 / v4-r2 / v4-input-r2` 三个 live 轮（design 不带 .meta，纯移动安全）。

**要你一句话拍板（灰色地带）**：
- `knowledge-base/`（6 篇 wiki 设计 md）→ **入库**（知识资产）✓？
- `mode-rules-truth-table.md`（模式规则真相表，对应 task#7）→ **入库**✓？
- `kb-guide/`（5.7M wiki 配图）、`kb-whiteboards/`（5M 画板导出）→ **ignore**（可从飞书重导，非源）✓？
- `diagrams/` → 留最终版 svg/json 入库、删 crop_*.png/err.log/裸时间戳目录 ✓？

**绝不能动（红线，全程只读）**：`assets/Script/jijie2/`、`data/`、`guantu/`、`assets/Scene/`、`design/`（已 tracked）、`projectplan.md`、`knowledge-base/` 内容、任何 `.meta`、`.harness-pro-*`（guard 保护）。

---

## 第二步：React 迁移架构

### 推荐路线 B（纯 React，jijie2 当库 import），分两段走，A 作过渡

- **段 1（PoC，A 形态过渡）**：保留 Cocos 启动壳只跑逻辑引擎，React 盖一屏（`<div id="react-root">` 绝对定位盖 `#GameCanvas`），验证「React 画 + 读 `JijieData` + 调 XP」全链通 + 设计精度/blur/主题三动机达成。**零风险**（jjbDesign 已在做「隐藏 jjUI / 自渲染 / 调 InitPanel」，只把「自渲染」从 cc.Graphics 换 React）。
- **段 2（cutover）**：抽 `jijie2` 纯逻辑 → 独立 Vite React 工程，删 Cocos + cocos2d-js，**包体 2.5MB→~200KB**。

### 技术栈
- **Vite + React + TS**（Vite 底层 esbuild/Rollup，给 dev HMR + 静态产物，`dist/` 直接喂 `:7777` serve + Cloudflare 通道）。
- **tsconfig 分叉**：现有 `tsconfig.json`（commonjs/es5）是 Cocos 专用，新建 `tsconfig.react.json`（es2020/esnext/jsx:react-jsx/bundler）。
- `jijie2` 用 **path alias `@logic/* → assets/Script/jijie2/*`**，不复制——单一真相源，Cocos 线和 React 线读同一份逻辑。
- React 落点：**仓库根新建 `web/`**（独立 package/构建，不塞 `assets/`，否则 Cocos 编辑器扫描报错）。`jjbDesign/` 迁移期保留为 Cocos 回退，逐屏废弃。

### 6 主题（CSS variables 直接承接，JJBTheme 退役）
- `design/v4-r2/styles.css` 已是「`.style-{metal|sc2|minimal}.mode-{dark|light}` 切 CSS 变量」成品，6 套全在。`JJBTheme.ts` **整个删**（它存在就为喂 cc.Graphics）。
- 主题切换 = 根节点换 class（`useState`），CSS 级联自动重渲，**零重建、零数据丢失**，比现在「重渲整屏」干净一个数量级。
- 字体走 `@import` Google Fonts，省掉手动注入。

### 组件（design/v4-r2/components/*.jsx 收编为生产组件）
- 这些 jsx 从「影子」变「真身」：design-sync 推 Claude Design 的组件和 repo 跑的是同一文件，**翻译那步消失**（动机④）。
- 两个核心组件 **`<FactorFrame>`（承接 framedFactorV4）+ `<CommanderCard>`（承接 framedCmdV4）**——下游 6 屏全依赖，先做对。边框**走真实 PNG 整图/9-slice**（design 项目有边框 PNG），避开 JJBBorder 那 10 处描边堆叠。
- 实测净改：每屏 ~30% 代码（数据绑定 + 事件接线），70%（DOM 结构 + 6 主题样式）白嫖。

### XP 对接契约（红线零改，详见调研「XP 对接面」）
- `import` 三个纯逻辑静态类：`JijieData` / `JijieControl` / `ConfigData`。
- **开局序列**（复刻 `JJBDesignBoot.onMode`）：`initStart() → reset() → restoreConfigData(ConfigData.init 重建母池) → 直设 JijieData.modelFactorCount/mode flag/playerName（绕过 InitPanel.jjUI，用纯逻辑赋值） → JijieControl.toStart()`。
- 数据源：`JijieMain.instance` 的 5 个 `TextAsset.text`（boot 时导出到 store），或纯 React 段 `fetch('/jjdata/*.txt')` 喂 `ConfigData.init`。
- 渲染：读 `JijieData.*` → `JJBData.sessionMatches()` 投影 3 场 VM。
- 写回：select 屏写 `selectedCommanderList`/`selectedFactorList`（jjbDesign 自有语义，XP 不读，**按 `manualSlots(slot)` 逐格判选满，禁按 length/null 计数**）；battle 屏写 `winLoseList[i]=0|1|2` + 记分由 winLoseList 重算（`winCount` 已含带奖励，不再 +winbCount）。
- **保留 `window.__jjbDebug` 同名同形透出**（4 套 Playwright 回归读它断言，破了全挂）。

### OBS 直播采集（DOM 可采，横条形态重做更简单）
- OBS 浏览器源采渲染后画面，DOM/canvas 一视同仁（SOP 已验证）。
- 横条：`<ObsBar>` 组件，`?bare=1` → body 套 `.obs-bare` class，CSS 定死 `1280×232`、`overflow:hidden`，**删世界矩阵补偿那 160 行**；`?bartop=1` = `position:fixed;top:0`。`design/v4-r2/components/obs-bar.jsx` 现成。
- **blur / capped ResolutionPolicy / designResolution 切换全消失**（DOM 文字矢量渲染永远锐利）。

---

## PoC 选屏（要你拍板，两份调研有分歧）

| | Battle（Cocos 清单推荐） | Select（React 架构默认 / 你原话） |
|---|---|---|
| 行数/复杂度 | 207 行，中 | 438 行，**全层最复杂**（拖拽吸附+动态槽+校验） |
| 接缝验证 | 写 winLoseList + 调 showResultEnd(空实现)，**接缝简单** | 写 selected*，拖拽逻辑重 |
| 附加价值 | 最小完整切片、快拿设计精度证据 | **BP 整合就在 select**、现成 select-screen.jsx，一举两得 |
| 风险 | 低 | 高（PoC 阶段引入 React 拖拽库选型变量） |

**我的综合推荐**：**先 Battle 做接缝 PoC**（小、稳、快拿「设计精度/blur/主题/React↔XP 接缝」证据），接缝验证通过后**第二屏立刻上 Select（带 BP 整合）**。若你想直接见 BP 整合成果，PoC 直接上 Select（接受拖拽复杂度）。

---

## 逐屏迁移顺序

1. **地基**：`JJBTheme`→themes.css（6 主题 CSS 变量）+ `JJBData`/`JJBDoubles` 原样搬（纯逻辑零改）。
2. **两核心组件**：`<FactorFrame>` + `<CommanderCard>`（边框走 PNG）。
3. **PoC**：Battle（或 Select）打通 React↔Cocos 接缝。
4. **纯展示屏收割**：Result → Overlay → ObsBar（采集核心，删 exposeDebug 收益最大）→ Dock → Bp。
5. **重交互压轴**：Select（拖拽吸附，单独立项；BP 整合并入此屏）。
6. **编排最后**：`JJBDesignBoot` 拆 React Router + `useJjbSession()` controller（保留 onMode/startManual/startRandom/restoreConfigData 接缝逻辑）+ `<ControlBar>` 组件，删 fitView/cappedPolicy/fresh/designResolution 全套画布管理。

---

## harness-pro phase 划分（≥3）

- **Phase 0（go/no-go 审计）**：审计 `JijieContro`/`JJUI` 的 19 处 cc.*，分「纯逻辑(段2 搬)」vs「UI 副作用(段2 React 重写)」，定段2 重写量。**这是 go/no-go 关键，第一步先做。**（强暗示：核心随机/状态机在 initPanel+JijieData，JJUI 多为 UI 副作用 → 重写量远小于表面 19 处。）
- **Phase 1（脚手架+地基）**：建 `web/` Vite 工程 + tsconfig.react + `@logic` alias + themes.css(6 主题) + JJBData/JJBDoubles 搬入 + 两核心组件。done-when：6 主题 CSS 变量切换可见、FactorFrame/CommanderCard 渲染对。
- **Phase 2（PoC 屏）**：Battle(或 Select) React 版，打通接缝（隐藏 jjUI、Cocos 跑逻辑、React 读写 JijieData、__jjbDebug 同形）。done-when：真机一局走通、设计精度/blur 对比通过、Playwright 回归绿。
- **Phase 3+（逐屏迁移）**：展示屏批量 → Select(BP 整合) → 编排拆解。
- **末 phase（cutover）**：全 6 模式真机 + OBS 16:9 回归，Cocos build 保留可回滚直到全模式过验。

---

## 红线与风险

- **红线**：`jijie2`/`JijieData`/`ConfigData`/`Scene`/`design` 零改；React 只读桥 + 调 `initPanel.onClickX` 等价纯逻辑 + 写 `selected*`/`winLoseList`。
- **R1（段2 唯一硬骨头）**：`JijieContro`/`JJUI` 19 处 cc.* 重写量未定 → Phase 0 审计定 go/no-go。
- **R2**：资源 `cc.resources.load` → `<img src="/images/...">`，需逐目录核对 `assets/resources/images/{maps,commander,factor,brand}/` 文件名。
- **R3**：`.txt` fetch 时序——`ConfigData.init` 须在任何屏读数据前完成，加 loading gate。
- **R4**：cutover 即上线——保留 Cocos build 可回滚，直到 React 全模式过验。

---

## 上下文包（给 round 执行者的精炼 brief）

- **逻辑层（零改，库化）**：`assets/Script/jijie2/JijieData.ts`(状态字段真相)、`data/JJConfigData.ts`(抽取/池原子)、`JijieContro.ts`(toStart/toSelect/toBattle)、`view/InitPanel.ts`(模式 handler=纯逻辑赋值)、`JijieMain.ts:36`(5 csv TextAsset)。
- **现成桥（React 复用）**：`assets/Script/jjbDesign/JJBData.ts`(jjbLive/sessionMatches/manualSlots/facFlatIdx)、`JJBDoubles.ts`(纯逻辑搬)。
- **现有调用范式**：`JJBDesignBoot.ts` onMode(L279)/startManual(L344)/startRandom(L363)/exposeDebug(L401)/restoreConfigData(L54)。
- **React 生产组件源**：`design/v4-r2/components/{select-screen,battle-screen,obs-bar}.jsx`、`styles.css`(token)+`theme.css`(结构)。
- **退役目标**：`JJBView.ts`/`JJBTheme.ts`（cc.Graphics 画笔）。
- **验证基建**：`window.__jjbDebug` 同形；4 套 Playwright 回归（jjb-verify skill）。
- **技术栈定**：Vite+React+TS、路线 B 分两段、6 主题 CSS-var、组件收编 design/v4-r2。

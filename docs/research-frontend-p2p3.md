# 集结杯 P2 截图导出 + P3 码方案 — 前端实施方案

> 已对 live truth 核实：`web/` 零运行时依赖（仅 react/react-dom）、字体走 Google Fonts CDN 异步加载、`clip-path: polygon()` 斜切**仅存在于 `.style-metal`** 皮肤（sc2/minimal 无）、选择态分**单打**(`JijieData`/`jjbSession`)与**双打**(`jjbDoubles` 模块态)两套并行形状、`?bare=1` 已隔出纯采集 DOM、`App.tsx` 当前只读 `?query` 不读 `#hash`、码方案稳定排序源 = `mutatorPool.ts` 的 `MUTATOR_POOL.A/B/C` + `config/factors.ts` 的 71 条 `FACTORS`（指挥官仍在 jjdata CSV，未进 config/）。

一句话总纲：**P2 用 snapDOM 截 `?bare=1` 的横条 / 整屏 DOM，复制优先下载兜底；P3 码方案必须编码"已 roll 的整盘"（地图/锁定/池）而非仅"mode+手选"——因为开盘是 `Math.random` 不可由 mode 复现**。这条是 P3 全部设计的地基，下面 §B.1 详述。

---

## A. P2 截图导出（snapDOM）

### A0. 选型复核（snapDOM vs html2canvas vs html-to-image）

| 维度 | snapDOM | html2canvas | 结论 |
|---|---|---|---|
| `clip-path: polygon()` 斜切角 | ✅ 原生（`<foreignObject>` 直接序列化真实 DOM+CSS） | ❌ 自绘渲染器不支持 clip-path，斜角被画成方块 | **本项目 metal 皮肤的斜切卡/按钮是 html2canvas 死穴，snapDOM 必选** |
| CSS 阴影/`box-shadow`/紫环官突框 | ✅ | ⚠️ 部分丢失 | snapDOM 保真（`.fx.mutator` 紫环、点金金框是核心视觉） |
| 中文 web 字体 | ✅ 配 `embedFonts`+`fonts.ready` | ⚠️ 需手动喂字体 | 见 A2 |
| 体积/依赖 | 单包零依赖 | 较大 | 与"零运行时依赖"现状最小冲突，加 1 个 dep |

> 注：项目当前没有任何 SC2 商用字体文件，正文中文走 **Noto Sans SC / Noto Serif SC（Google Fonts CDN）**。所谓"SC2 中文字体"在 web 里实际是 Noto 系 + Oswald 数字。`embedFonts:true` 会把 CDN 字体子集内嵌进 PNG —— 见 §B 风险与开放问题 §C.4 的版权口径（Noto 是 OFL 可商用，比真 SC2 字体安全）。

### A1. 截哪些屏 + 各自的 capture 目标节点（精确到 className）

三类产物，**capture 根节点不同**，都已有现成隔离手段：

| 产物 | 触发屏 | capture 根节点 | 隔离手段（现成） | 备注 |
|---|---|---|---|---|
| **① 选择面板** | `screen=select` | `.jjb-inner.sel`（含 topbar+slots+pool）或外层 `.jjb`（1280×720 含背景） | 截 `.jjb` 含 `.jjb-bg` 渐变/纹理/暗角；截 `.jjb-inner.sel` 则透明背景便于二次合成 | 单打/双打同 `.jjb` 容器，DOM 不同但根一致 |
| **② 对局/结算** | `screen=battle` / `result` | `.jjb`（整屏 1280×720） | 同上 | 主用于赛后分享战绩 |
| **③ OBS 横条** | `screen=obs&bare=1` | `.obs-host[data-bare="1"]` 内的 `ObsBar` 根 | `?bare=1` 已隐藏控制条/返回钮，`.obs-host` padding=0 | 横条形态最常截，宽屏窄高 |

实现纪律：capture 目标用 `data-*` 锚点选，**不要选 `.jjb` 这种会命中多个的类**。建议给三个根加显式锚点：select 根加 `data-capture="select"`、battle/result 根加 `data-capture="battle"`、`.obs-host` 已有 `data-bare` 可直接用 `[data-capture]` 统一查询。`switcher`（顶部固定工具条，`position:fixed zIndex:100`）**不在任何 `.jjb` 子树内**，天然不入图，无需隐藏。

- 方案：新增 `web/src/lib/capture.ts`（`captureNode(el, opts)` 封装 snapDOM）+ 一个 `<CaptureButtons targetSelector=… filename=…/>` 组件，挂到 SelectScreen 底部操作区（`.startbtn` 旁，第 457-472 行那组按钮）、ResultScreen、ObsScreen 控制条（`!bare` 分支内，第 82-102 行）。
- 风险：`?bare=1` 是给整个 App 的全局旗标（`App.tsx:bare` + 各屏自读），截图按钮本身必须只在 `!bare` 渲染，否则采集产物里混进按钮。已有 `!bare &&` 模式可直接复用。
- repo 集成点：
  - 新建 `web/src/lib/capture.ts`
  - 新建 `web/src/components/CaptureButtons.tsx`
  - `SelectScreen.tsx:448-473`（单打操作区）+ `:666-677`（双打操作区）插按钮
  - `ObsScreen.tsx:82` 的 `!bare` 控制条块加按钮
  - `ResultScreen.tsx`（赛后战绩，未读全文，挂底部操作区）

### A2. SC2/中文字体处理（`document.fonts.ready` + embedFonts）

问题根因：`index.css:3` 的字体是 CDN `@import` **异步加载**，首屏 `snapDOM` 抢跑会截到 fallback sans-serif（数字 Oswald 尤其明显，难度分/比分会变字形）。

方案（顺序严格）：
```ts
// capture.ts 内
await document.fonts.ready;            // 等 CDN 字体落地（关键，解决糊/变形）
// 可选稳健：显式 load 关键族，防 ready 在某些浏览器对 @import 误报就绪
await Promise.all([
  document.fonts.load('700 16px "Noto Sans SC"'),
  document.fonts.load('700 16px "Oswald"'),
  document.fonts.load('900 16px "Noto Serif SC"'),
]).catch(() => {});
const result = await snapdom(el, { scale, embedFonts: true, backgroundColor: null });
```
- `embedFonts:true`：把用到的字体子集内嵌进导出 SVG/PNG，保证对端打开 PNG 不依赖其再次加载 CDN（截图是位图，本来也不依赖，但 snapDOM 内部走 `<foreignObject>` 渲染，内嵌可避免渲染瞬间 fallback）。
- 风险 1：CDN 在国内偶发慢/被墙 → `fonts.ready` 可能长等。缓解：`Promise.race([document.fonts.ready, timeout(1500)])`，超时也继续截（宁可偶发一张 fallback 也不卡死按钮）。**更彻底的修**见 §C.4：把 Noto 子集自托管进 `web/public/fonts/`，去掉 CDN 依赖（与"打公网 CF Pages、数据自掌控"方针一致）。
- 风险 2：`embedFonts` 内嵌全字符集会让 PNG 数据膨胀。snapDOM 默认按用到的字形子集内嵌，正常；若发现产物过大，关 `embedFonts` 改为纯位图（`fonts.ready` 已保证渲染时字体在场）。
- repo 集成点：`web/src/lib/capture.ts`（唯一字体逻辑落点）。

### A3. clip-path 斜切框正确裁切

- 现状：斜切 `polygon()` **只在 `.style-metal`**（`home-mode.css`/`bp-config.css`/`promo-bar.css`/`random-enemy.css` 共 ~14 处）。sc2/minimal 皮肤无斜切（圆角/直角）。
- 方案：snapDOM 走 `<foreignObject>` 把真实 DOM 子树连同 computed CSS（含 `clip-path`）整体序列化，浏览器自身渲染 SVG → 斜角**天然正确**，无需任何特殊处理。这正是不选 html2canvas 的唯一硬理由。
- 验证断言（写进 jjb-verify 截图回归）：metal 皮肤截 select，肉眼/像素比对卡片右下角是斜切非直角；对 `.bpc-row`/`.loginbtn`/`.pcard.ladder` 三类典型斜切元素做存在性 + 形状抽检。
- 风险：snapDOM 对某些 `backdrop-filter`、外部 `mask` 可能不保真（项目未用 backdrop-filter，低风险）；`clip-path` 用 `calc()` 的 polygon snapDOM 支持，但**跨域图片**（CDN 字体除外）若出现会污染 canvas → 本项目图片全是同源 `web/public/images` glob，无跨域问题。
- repo 集成点：无需改 CSS（红线本就禁改 assets，这里 web 侧 CSS 也不必动）；只在 capture.ts 用对的库。

### A4. 复制剪贴板（Chromium 主路径）vs 下载（兜底）双按钮

- 方案 — 两个按钮并排：
  - **「复制图片」**（主，Chromium）：
    ```ts
    const blob = await result.toBlob({ type: 'image/png' });
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    ```
    成功 → toast「已复制，可直接粘贴到飞书/微信」。
  - **「下载 PNG」**（兜底，全端）：`result.download({ filename })` 或 `a[download]` + `URL.createObjectURL(blob)`。
- 能力探测决定主按钮可用性：`const canCopy = typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write`。Firefox/Safari/移动端 `ClipboardItem` 缺失或 `image/png` 写入受限 → 复制按钮置灰/隐藏，只留下载。**不要 try 复制失败再 fallback**（部分浏览器抛异步异常难捕获），直接按 `canCopy` 决定渲染哪个/置灰。
- 剪贴板权限：`navigator.clipboard.write` 须在**用户手势内**（按钮 onClick 同步链）触发，且页面非 http（CF Pages/`/api` 同源 https 满足；本地 `localhost` 也算 secure context）。
- 风险：① `ClipboardItem` 在 Safari 需 blob 用 Promise 形式（`new ClipboardItem({'image/png': blobPromise})`）——Safari 走下载兜底即可不踩。② `await document.fonts.ready` 后再 `await clipboard.write`，中间隔了 await，**部分浏览器视作脱离用户手势** → 复制被拒。缓解：把 `fonts.ready` 提前到屏挂载时预热（`useEffect` 里先 `document.fonts.ready`），按钮点击时字体已就绪，复制链路内不再有长 await。这条是双按钮能否稳的关键工程细节。
- repo 集成点：`CaptureButtons.tsx`（能力探测 + 双按钮 + toast，复用 SelectScreen 现成 `toastv` 类）。

### A5. scale 高清

- 方案：`snapdom(el, { scale: 2 })` 默认；横条窄高可上 `scale: 3`。导出尺寸 = 1280×720 × scale。提供「标清/高清」隐性策略：默认 2，OBS 横条 3。
- 风险：`scale:3` × 1280×720 ≈ 3840×2160 PNG，移动端内存峰值可能 OOM（低端机）。缓解：移动端探测降到 2；横条因高度小（~120px）即便 ×3 也才 3840×360，安全。
- repo 集成点：`capture.ts` 的 `opts.scale`，按 `targetSelector`/UA 给默认值。

### A6. P2 落地清单（最小集成）

```
web/package.json            +1 dep: @zumer/snapdom（或等价 snapdom 包，装前 probe 实际包名/导出）
web/src/lib/capture.ts      新建：captureNode() 封装 fonts.ready+load+snapdom+toBlob；copyToClipboard()/downloadPng()
web/src/components/CaptureButtons.tsx  新建：能力探测双按钮 + toast
web/src/screens/SelectScreen.tsx       :448 单打操作区 / :666 双打操作区 各挂一组（!bare 时不挂）
web/src/screens/ObsScreen.tsx          :82 !bare 控制条块挂一组（截 .obs-host）
web/src/screens/ResultScreen.tsx       底部操作区挂一组
（三个 capture 根加 data-capture 锚点；switcher 是 fixed 不入图免处理）
```

---

## B. P3 码方案（选择状态 → URL #hash）

### B1. ★地基结论：必须编码"已 roll 的整盘"，不是"mode + 手选"

读 `jjbSession.toStartCore`/`toSelectCore` 与 `jjbDoubles.doublesStart` 后确认：**开盘全程 `Math.random`**——3 张地图、3 个锁定因子、随机因子池、A4/B2 指挥官抽取（B 组还有德哈卡/泰凯斯 0.25 加权）、自选池、双打的 per-match 官突条目，**都不可由 `mode` 复现**。

因此"贴码开局"要在对端还原**同一盘**，码必须携带这张**已生成的盘面**，而不只是玩家的手选。这把 payload 从"~100 bytes 的几个索引"放大到"整盘索引集"。重新估算如下，仍远低于 2000 上限，但**这是 §C.2 旧调研'~100 bytes'的修正**。

**单打 payload 形状**（全部存 index，不存中文名）：
```
v(版本) | mode(0-10 枚举) | ruleMode(0/1)
maps[3]        → 每个 = mapList 在地图母表的 index（~7bit ×3）
lock[3]        → 锁定因子在 factors 母表 index（~7bit ×3）
pool[]         → randomFactorPoor 各因子 index（sumSlots 个，≤9，~7bit each）
cmdA[]/cmdB[]  → 抽中指挥官 index（~6 个，~7bit each）
selfShow(1bit) + selfPool 不存（= 全量母表减已入池，可由 cmdA/cmdB 重算，省空间）
picks: selCmd[3] → 每场选中指挥官 index（或 255=空）
       selFac[9] → facFlatIdx 扁平 9 格，每格因子 index（255=空）
gold[]         → 运行时点金因子 index 列表
ban[]          → BP ban 因子 index 列表
```
粗算：约 30-45 个小整数 → 紧打包 ~50-70 bytes → base64url ~70-95 字符。**双打**（variant + 3×2 cmd + 3×3 fac + 3 个 mut 条目 index + 池）类似量级。**结论不变：离 2000 上限极远，零依赖、不需要 lz-string / 后端短链**；但码不是"~100 bytes 极小"，是"~100-200 字符量级"，需要正确打包别用 JSON 明文直 base64（明文 JSON 会到 ~400-600 字符，仍可用但浪费）。

> 折中（更省事、可读性换长度）：第一版**直接 `JSON.stringify(snapshot)` → base64url**，~400-600 字符，仍安全；待嫌长再换二进制紧打包。建议第一版走 JSON（实现简单、调试友好、解码校验直观），把"紧打包"列为后续优化。下文按 JSON 版写集成点，紧打包作为 §B.6 优化项。

### B2. 索引化 + 稳定排序源（与 mutatorPool / 指挥官表对接）

码里所有"指向枚举"的字段存**稳定数组下标**。各维度的排序真相源：

| 维度 | 稳定源（当前 live） | 取 index 方式 | 风险 |
|---|---|---|---|
| 因子 | `config/factors.ts` 的 `FACTORS`（71 条 frozen 数组） | `FACTORS.findIndex(f=>f.name===name)` | ✅ 已是单源、frozen；但**注意**：jjbSession 运行期当前仍读 jjdata 副本（config 尚未 cutover，见 config/README），两表因子集**不完全一致**（jjdata 42 vs config 71）。码方案应钉死 `config/factors.ts` 为索引源，且校验运行期出现的因子都能在 FACTORS 命中 |
| 官突（双打锁定） | `mutatorPool.ts` 的 `MUTATOR_POOL[tier]` 数组顺序 | `{tier, ordinal}` 二元组 = `MUTATOR_POOL.A` 中第几个 | ✅ 注释已声明 "do not hand-edit"；但它"AUTO-GENERATED"实为一次性手动产物，**重排即错位** → 必须上 §B.5 纪律 |
| 指挥官 | ⚠️ **当前无 frozen 单源**：运行期来自 `ConfigData.commanderList`（jjdata `指挥官配置.txt`），双打来自 `jjbDoubles` 里硬编码 `COMMANDER_A/B` 常量 | 临时用 `指挥官配置.txt` 行序；**但该表会动** | **最大隐患**：指挥官没有像 factors 那样的 frozen TS 母表。建议 P3 顺手补 `config/commanders.ts`（frozen 数组）作索引源，否则指挥官 index 不稳 |
| 地图 | 来自 jjdata `地图配置.txt`（13-15 张） | 行序 | 同指挥官，建议进 config |
| 模式 | `jjbSession.SessionMode` union（11 个字面量） | 固定枚举序数（手钉一张 `MODE_CODES` 常量，**不要**用 union 顺序，union 改序会错） | 低风险，钉死即可 |

- 方案：新建 `web/src/logic/codeScheme.ts`，内部维护"name↔index"双向表，**index 源显式 import** `config/factors.ts` + 新建 `config/commanders.ts` + `config/maps.ts` + `mutatorPool.ts` + 手钉 `MODE_CODES`。
- 风险：指挥官/地图当前无 frozen 源是真缺口。**P3 前置建议**：把指挥官/地图也落 `config/*.ts`（与 P0 已建的 `config/factors.ts` 同形），让码方案有稳定索引基。否则只能存中文名（长度涨 + 改名即废）。
- repo 集成点：
  - 新建 `web/src/logic/codeScheme.ts`（编解码 + 索引表 + 版本校验）
  - 新建（建议）`web/src/config/commanders.ts`、`web/src/config/maps.ts`（frozen 数组，gen-config.mjs 产出，对齐 §C 既有骨架）
  - `web/src/data/mutatorPool.ts` 不改（只读其顺序）

### B3. base64url → URL `#hash` + 解码入口

- 编码：`snapshot → JSON → utf8 bytes → base64url`（`+/=`→`-_`、去 `=`）。URL 形如 `…/?screen=select#c=<base64url>` 或独立 `#jjb=<…>`。
- **为何 `#hash` 而非 `?query`**：①hash 不进服务器访问日志（隐私 + 契合"练习不落库"）；②不触发 SPA 路由刷新；③CF Pages 静态托管对 hash 零成本。
- 解码入口（**当前缺口**）：`App.tsx` 现在只读 `?query`（`q()` 函数），**完全不读 `#hash`**。需新增：App 初始化时 `parseCodeFromHash()` → 若有合法码 → 调 `codeScheme.applySnapshot()` 重建 `JijieData`/`jjbDoubles` 模块态 → `navigate('select')`（贴码默认落选择屏，让对端看牌/微调/开局）。
- 方案：`applySnapshot` 不能走 `startSession`（那会重新 `Math.random` 开新盘）。要**直写**模块态：单打直接 set `JijieData.{mapList,lockFactorList,randomFactorPoor,randomCommanderPoorA/B,selectedFactorList,selectedCommanderList,modeXxx flags,status=2}` + `goldRuntime`/`bpBanRuntime` + `ruleMode`；双打调一个新 `jjbDoubles.applyDoublesSnapshot()` 直填 `_mutEntries/_factorPool/_commanderPool/_slots/_variant/_live`。这两个直写函数是 P3 的核心新代码。
- 风险：① `JijieData` 字段多且是 `public static`，直写要覆盖全 §B1 列出的字段，漏一个就盘面不一致 → 用 `getSelectState()` 的字段清单做 checklist，**编码/解码对称性测试**（encode(state)→decode→深比对原 state）当 done-when。② 解码后必须 `exposeSelectDebug()` 刷 `__jjbDebug` 供 e2e。③ hash 改变不触发 React 重渲 → applySnapshot 后手动 `navigate`/`setState`。
- repo 集成点：
  - `App.tsx`：初始化 `useEffect` 加 hash 解析分支（在 `screen==='select'` 兜底**之前**，否则会被 std8 兜底覆盖——参照现有 `doublesLive()` 守卫写法 `:95`）
  - `codeScheme.ts`：`encodeSnapshot()` / `decodeSnapshot()` / `applySnapshot()`
  - `jjbDoubles.ts`：新增 `applyDoublesSnapshot(snap)`（直写 `_*` 模块态 + `_live=true` + `exposeDebug()`）
  - `jjbSession.ts`：新增 `applySingleSnapshot(snap)`（直写 `JijieData` + gold/ban/ruleMode + `exposeSelectDebug`）

### B4. 版本号 v + 解码校验（池长度 / 哈希）

- 方案：snapshot 顶层带 `v:number`（schema 版本）+ `p:number`（pool 指纹）。解码三道闸：
  1. **版本闸**：`v !== CURRENT_V` → 不还原，提示「码版本过期，请用新版重新生成」。
  2. **指纹闸**：`p` = 对索引源做的稳定哈希（如 `FACTORS.length*1000 + MUTATOR_POOL.A.length*100 + commanders.length` 或更稳的 FNV over 拼接 name 串）。解码端重算指纹 ≠ 码内 `p` → 提示「码与当前数据版本不符（池已更新）」。
  3. **越界闸**：每个 index 解出后 `if (idx >= source.length) throw`，防越界静默错位。
- 风险：纯 `length` 指纹只能抓"增删"不抓"重排同长"（A 池换两条目顺序、长度不变 → length 指纹漏检 → 错位）。**所以指纹必须基于内容**（拼 name 串哈希），不能只用 length。这条直接对应你 prompt 里"哈希校验池长度/哈希"——答案是**两者都要，且哈希要 over 内容**。
- repo 集成点：`codeScheme.ts` 顶部 `CURRENT_V` 常量 + `poolFingerprint()` 函数 + decode 三闸。

### B5. 池重排纪律（追加不重排 or 存稳定名）

三选一，按数据维度分别定：

| 维度 | 推荐纪律 | 理由 |
|---|---|---|
| 官突 `MUTATOR_POOL` | **追加不重排**（新官突 append 到 A/B/C 数组尾） | 已是 AUTO-GENERATED 注释保护；ordinal 索引稳。gen 脚本须保证输出顺序稳定（按 CSV 行序，不排序） |
| 因子 `config/factors.ts` | **追加不重排** + frozen | 71 条已 frozen，gen-config 须钉死输出序（当前看似按 points 排——**危险**，points 改了会重排！建议 gen 脚本改为按 CSV 原始行序输出，或额外存一列稳定 id） |
| 指挥官/地图 | **存稳定名而非纯下标**（短，可接受） 或 补 frozen `config/commanders.ts` | 这两表最易动、且当前无 frozen 源；过渡期存中文名最稳，长度代价小（指挥官名 2-4 字 ×6） |

- 方案：码方案**混合**——官突/因子存 index（有 frozen 源 + append 纪律），指挥官/地图过渡期存名（无 frozen 源）。版本指纹覆盖前两者。待指挥官/地图也 frozen 化，再转 index。
- ★**立即风险**：`config/factors.ts` 现在**按 points 升序排列**（读文件可见 1→10 分递增）。若 gen-config 是"读 CSV 后按 points 排序输出"，那么**任何因子点数调整都会重排整个数组 → 所有旧因子 index 错位 → 所有旧码失效**。P3 落地**必须先确认 gen-config.mjs 的排序逻辑**：若按 points 排，要么改成按 CSV 行序（稳定），要么给 FactorDef 加显式 `id` 字段，码存 id 不存数组下标。**这是 P3 能否长期稳定的头号前置，建议先查 `web/scripts/gen-config.mjs`。**
- repo 集成点：`web/scripts/gen-config.mjs`（确认/改排序为稳定序，或加 id 列）；`mutatorPool.ts` 的生成器同纪律。

### B6. 比赛模式「贴码开局」+ 与后端复用

- 方案：贴码即 §B3 的 hash 解码落 select 屏。比赛模式下，主播/选手把码贴进一个输入框（或直接打开带 hash 的 URL）→ `applySnapshot` → 同盘。与 §C 后端 §5.2 的 `matches.payload_code` **复用同一 `encodeSnapshot` 输出**：一局存库 = 存这串码，导出/分享/落库三态同源，这是旧调研 §5.2/§7-8 已拍的方向，P3 直接落同一编码器即可。
- 进一步：比赛模式可加「生成码」按钮（与 P2 截图按钮并排），主播开盘后一键出码发群，选手贴码进同盘 BP。
- 风险：贴码开局若落 `status=2`（选择态）正确；但若想"贴码直接进对局"需 `status=3` + 校验手选已填满——建议贴码恒落 select 让对端确认，不直接跳 battle（避免半盘码进 battle 触发兜底随机覆盖，参照 `BattleScreen` 兜底逻辑）。
- repo 集成点：
  - 比赛模式贴码输入框：HomeScreen 比赛 tab 内加「贴码开局」入口（`HomeScreen.tsx` 现有 practice/match tab + `setRuleMode`），调 `codeScheme.decode+apply`
  - 「生成码」按钮：复用 `CaptureButtons` 同位置，或独立 `<CodeButtons/>`
  - 后端复用：`encodeSnapshot()` 即 `matches.payload_code` 写值（P5 接入时零额外编码逻辑）

### B7. P3 落地清单（最小集成）

```
web/src/logic/codeScheme.ts        新建：encodeSnapshot/decodeSnapshot/applySnapshot + 索引表 + CURRENT_V + poolFingerprint + 三道校验闸
web/src/config/commanders.ts       建议新建（frozen 指挥官母表，gen-config 产出）→ 给码方案稳定指挥官 index
web/src/config/maps.ts             建议新建（frozen 地图母表）→ 同上
web/scripts/gen-config.mjs         ★先查：factors 输出是否按 points 排序（若是→改稳定序 or 加 id 列），否则旧码会因点数调整全废
web/src/logic/jjbSession.ts        +applySingleSnapshot(snap)：直写 JijieData 全字段 + gold/ban/ruleMode + exposeSelectDebug（不走 startSession 避免重 roll）
web/src/logic/jjbDoubles.ts        +applyDoublesSnapshot(snap)：直写 _mutEntries/_factorPool/_commanderPool/_slots/_variant/_live + exposeDebug
web/src/App.tsx                     初始化 useEffect 加 #hash 解析分支（置于 select 兜底之前，仿 doublesLive() 守卫），合法码→apply→navigate('select')
web/src/screens/HomeScreen.tsx     比赛 tab 加「贴码开局」输入入口
（done-when：encode→decode→深比对原 snapshot 全等；坏版本/坏指纹/越界码各有提示不崩；e2e 跑「生成码→新标签贴码→__jjbDebug.select 盘面全等」）
```

---

## C. 跨 P2/P3 的风险与开放问题（留拍板）

| # | 问题 | 现状 | 建议 |
|---|---|---|---|
| 1 | **指挥官/地图无 frozen 索引源** | factors 已 frozen 进 config，指挥官/地图仍在 jjdata CSV + jjbDoubles 硬编码 | P3 前先补 `config/commanders.ts`+`maps.ts`（gen-config 产出），否则码只能存中文名 |
| 2 | **`config/factors.ts` 疑按 points 排序** | 文件呈 1→10 分递增，若 gen 脚本排序则点数调整=全数组重排=旧码全废 | ★头号前置：查 `gen-config.mjs`，改稳定行序或加显式 `id` 列，码存 id |
| 3 | **运行期因子源 ≠ 码索引源** | jjbSession 运行期读 jjdata（42 因子），码索引拟用 config（71 因子）| 码索引钉死 config/factors；解码时校验运行期因子都能命中，命中失败给明确报错 |
| 4 | **字体版权 + CDN 依赖** | 正文 Noto SC（OFL 可商用，比真 SC2 字体安全）走 Google Fonts CDN | `embedFonts` 内嵌 Noto 子集版权 OK；但 CDN 国内不稳→建议自托管 Noto 子集进 `web/public/fonts`，去 CDN（兼修 A2 慢加载 + 契合公网托管自掌控） |
| 5 | **截图 capture 锚点缺失** | 三个根都是 `.jjb`/`.obs-host`，`.jjb` 会命中多元素 | 加 `data-capture="select|battle"`，统一 `[data-capture]` 查询；switcher 是 fixed 天然不入图 |
| 6 | **剪贴板 await 脱手势** | `fonts.ready` 长 await 后 `clipboard.write` 可能被判脱离用户手势 | 屏挂载预热 `fonts.ready`，按钮点击链内不再有长 await；Safari/移动端按 `ClipboardItem` 探测直接降级下载 |
| 7 | **双打盘面直写函数** | jjbDoubles 是模块级闭包态，无对外直写整盘 API | 新增 `applyDoublesSnapshot` 直填 `_*`；编解码对称测试当 done-when |

**关键文件绝对路径速查**
- P2 落点：`/Users/bytedance/项目/jijiebei/web/src/lib/`（新建 capture.ts）、`/Users/bytedance/项目/jijiebei/web/src/components/`（新建 CaptureButtons.tsx）、`web/src/screens/{SelectScreen,ObsScreen,ResultScreen}.tsx`
- 字体真相：`/Users/bytedance/项目/jijiebei/web/src/styles/index.css:3`（CDN @import）；clip-path 仅 metal：`web/src/styles/{home-mode,bp-config,promo-bar,random-enemy}.css`
- P3 落点：`/Users/bytedance/项目/jijiebei/web/src/logic/`（新建 codeScheme.ts）、`web/src/App.tsx:92-104`（hash 解码插入点，仿 `:95` doublesLive 守卫）
- 码索引源：`/Users/bytedance/项目/jijiebei/web/src/data/mutatorPool.ts`（MUTATOR_POOL A/B/C 顺序）、`/Users/bytedance/项目/jijiebei/web/src/config/factors.ts`（FACTORS 71 条，★查排序）、`/Users/bytedance/项目/jijiebei/web/scripts/gen-config.mjs`（★排序纪律）
- 单打状态形状：`/Users/bytedance/项目/jijiebei/web/src/logic/jjbSession.ts`（`SelectState` 接口 `:504`、`getSelectState` `:535`、gold/ban/ruleMode 运行时态 `:798/:827/:820`）
- 双打状态形状：`/Users/bytedance/项目/jijiebei/web/src/logic/jjbDoubles.ts`（`DoublesState` `:141`、模块态 `_*` `:46-52`、`doublesStart` 随机开盘 `:79`）
- 索引函数：`/Users/bytedance/项目/jijiebei/web/src/logic/legacy/JJBData.ts`（`facFlatIdx` `:91`、`manualSlots` `:98`、`RESULT_VAL` `:80`）

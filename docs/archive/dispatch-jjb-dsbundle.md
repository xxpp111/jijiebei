<!-- dispatch_contract:v1 target=claude-session entry=goal relay=false -->
# 集结杯 design-sync off-script 生成 ds-bundle

<objective>
off-script 手工生成 `ds-bundle/` 目录（3 组件 DS 格式四件套 + CSS 闭包 styles.css + _ds_bundle.js + assets），供 hub 用 DesignSync 工具上传到新账号 design-system 项目 `fd3ab5f6-0a40-4df1-85e3-7bcf7a3aef0e`。

背景：集结杯(jjb)是 React/Vite 应用，design-sync 自动转换器(package-build.mjs)因 **esbuild 不认 import.meta.glob** 对 6/9 组件渲染崩（workflow 调研实锤：realAsset.ts/designAssets.ts 的 glob → 浏览器 `import.meta.glob is not a function`）→ 走纯 off-script 手工。旧云端 DS e956fe00 已 404(账号迁移到 maura.woodellis)，这是新账号从零建。本轮只同步 3 个有真实变更的组件(增量非全量)。纯文本禁图，遇图忽略；API 400 立即 STOP。
</objective>

<scope>
可以生成(不改源)：
- 新建 `ds-bundle/` 目录（DS 上传格式，已 gitignored）
- 可建临时 esbuild bundle 脚本在 `.ds-sync/`(已 stage 好 esbuild/ts-morph) 或 tmp/

只读输入(绝不改)：
- web/src/components/{EnemyBadge,ObsBar}.tsx + screens/HomeScreen.tsx(ModeButton 内联在 137-150 .mode-grid>button.mode-btn)
- web/src/styles/*.css + design/v4-r2/{theme,styles,v4,obs}.css(三皮肤 token 真相，**只读红线**)
- web/src/assets/races/race-{protoss,terran,zerg}.png(真图已在本地，复制进 ds-bundle 用)
- design-sync 子流程(DS layout 格式): /private/tmp/claude-501/bundled-skills/2.1.183/6ce0b98154e808223e0d04cb503ea521/design-sync/non-storybook/SKILL.md 的「What the converter emits」段 + lib/emit.mjs(四件套格式) + package-validate.mjs(验收 tag)

不要动：
- web/src 任何源文件(只读生成 ds-bundle，不改组件)
- design/v4-r2(只读红线，所有修正用更高 CSS 特异性覆盖)
- assets/Script·assets/resources·assets/Scene(Cocos 红线)
- 不自行 git commit / 不自行 DesignSync 上传(ds-bundle 交 hub)

## 要生成的 3 组件（workflow 调研 syncScope，本轮真实变更项）
1. **ModeButton** → 分组 `controls`。从 HomeScreen.tsx:137-150 内联 .mode-btn 抽成独立组件(七模式格，体现 5 号位非酋之轮/飞球之轮、6 号位官突双打去 soon 的新文案+态)。props 化：mode key/no/name/soon/onClick。
2. **EnemyBadge** → 分组 `game`。web/src/components/EnemyBadge.tsx(种族印花+AI名，lg/md/sm 三档)。race 真图已在 web/src/assets/races/ → 复制进 ds-bundle/assets/races/ + glob props 化(raceUrl 传预解析相对 URL，html 卡用相对路径)。
3. **ObsBar** → 分组 `game`。web/src/components/ObsBar.tsx(直播横条 1280×232，黑边/因子单行密排/横向动态三修)。复合体：cmdUrl/facUrl/mapUrl → mock 预解析 URL，作整屏示例卡。

## DS layout（每组件 `components/<group>/<Name>/`，参子流程「What the converter emits」）
- `<Name>.jsx`(组件源，glob props 化后能裸 esbuild bundle，无 import.meta.glob 残留)
- `<Name>.d.ts`(props 接口，**从 .tsx 真签名提取**，保留真 props 不要退化成 [key:string]:unknown — 这是手工路径优于 synth 的关键)
- `<Name>.prompt.md`(用法：props 表 + 组合示例)
- `<Name>.html`(预览卡，**首行必须** `<!-- @dsCard group="<group>" -->`，从 window.JjbWeb.<Name> 渲染，多 export=多 labeled cell)
顶层：`styles.css`(@import 闭包) + `_ds_bundle.js`(IIFE 挂 window.JjbWeb.{ModeButton,EnemyBadge,ObsBar}) + `assets/races/*.png`

## CSS 闭包 styles.css（workflow 调研次序硬约束）
①Google Fonts CDN @import(**置顶**，CSS 规范要求 @import 先于其它规则) ②design/v4-r2/theme.css(token 默认) ③design/v4-r2/styles.css(**最关键** — 6 个 .style-X.mode-Y 块各重定义整套 --accent/--ink/--panel-bg/--font-title，是三皮肤×明暗真相) ④v4.css ⑤obs.css ⑥web 本地 brand-gold/obs-fuller/jjb-select ⑦功能层(random-enemy.css for EnemyBadge / obs-name.css for ObsBar / home-mode.css for ModeButton)。
- design/v4-r2 的三级相对 @import(../../../design/v4-r2) **改为 ds-bundle 内实际相对路径**(把 design/v4-r2 需要的 css 复制进 ds-bundle 或调相对深度)
- 次序硬约束：token默认→皮肤覆盖→组件→功能层(靠 import 顺序 + 双类特异性决胜)，乱序皮肤色错
- 真组件 CSS 若进 _ds_bundle.css，必须从 styles.css @import 它(否则设计渲染收不到)

## glob props 化（核心，避开 import.meta.glob esbuild 崩）
- EnemyBadge raceUrl(code) → 改成接 prop 传入预解析 URL；race png 复制进 ds-bundle/assets/races/，.card.html 用相对路径喂
- ObsBar cmdUrl/facUrl/mapUrl → mock 静态 URL(整屏示例卡用占位或几张代表图)
- _ds_bundle.js 的 esbuild 配置**不能**残留 import.meta.glob 调用(grep 验)
</scope>

<validation>
done-when：
- ds-bundle/ 含 3 组件四件套(.d.ts/.jsx/.prompt.md/.card.html) + styles.css + _ds_bundle.js + assets/races/
- `_ds_bundle.js` IIFE 挂 window.JjbWeb.{ModeButton,EnemyBadge,ObsBar}；`grep import.meta.glob ds-bundle/_ds_bundle.js` 零命中
- 每组件 .card.html 首行是 `<!-- @dsCard group="..." -->`
- 每组件 .d.ts 是真 props 接口(非 stub)
- styles.css @import 闭包内每个文件都在 ds-bundle 内存在(无 [CSS_IMPORT_MISSING])
- `node .ds-sync/package-validate.mjs ./ds-bundle` 退出 0(或逐 [TAG] 自愈，render-check 需 playwright+chromium)
- Playwright 起 .card.html 渲染 3 组件 × 三皮肤(metal/sc2/minimal)×明暗：不崩(无 import.meta.glob error)、不裸渲染(有 token 样式)、ModeButton 七格/EnemyBadge 三档/ObsBar 横条视觉对齐 design/v4-r2

proof(真跑贴回原文)：
<pre lang="bash">
node .ds-sync/package-validate.mjs ./ds-bundle 2>&1 | tail -30
grep -c "import.meta.glob" ds-bundle/_ds_bundle.js  # 期望 0
ls -R ds-bundle/components ds-bundle/assets
</pre>
</validation>

<stop_when>
- import.meta.glob 无法 props 化绕开某组件 → 停报(别硬塞 glob 进 bundle)
- design/v4-r2 CSS 闭包相对路径无解 / token 缺失切不出三皮肤 → 停报
- 需改 web/src 源 / design/v4-r2 / Cocos 红线才能继续 → 停报
- package-validate 出 [RENDER]/[CSS_*] 自愈 3 轮无果 → 停报
- 不确定 = 停
不自行 commit、不自行 DesignSync 上传(ds-bundle 交 hub 收口上传 + 终验)。
</stop_when>

<context>
关键先读：design-sync 子流程 non-storybook/SKILL.md「What the converter emits」+「Self-heal loop」tag 表(知道 DS 格式与验收口径) + lib/emit.mjs(四件套真实模板) + web/src/lib/realAsset.ts(看 raceUrl/cmdUrl/facUrl 怎么 glob，props 化它们) + design/v4-r2/styles.css(三皮肤 6 块 token)。
harness round：planned_phases=3(①组件抽取+props化+esbuild bundle ②CSS闭包styles.css组装 ③package-validate+Playwright验)，用 DUBHE_API_KEY 走真 native review。init 后每条 CLI 显式 --runtime-dir + review 显式 --model-config；reviewer alias 与执行模型 disjoint。
</context>

<motivation>
账号迁移后旧 Claude Design DS(e956fe00)丢了，yb 要在新账号重建集结杯设计系统，让设计 agent 用真实组件出图(F 登录等后续设计基于它)。converter 自动路径已被 import.meta.glob 堵死，手工 off-script 是唯一可行路径。本轮先把 3 个有真实变更的组件(ModeButton双打/EnemyBadge随机敌方/ObsBar三修)立起来，后续可增量补。
</motivation>

# design-sync 现实记录（集结杯 → e956fe00）

> 锚定 design-sync skill 的真实状态，避免下次同步走错路。

## 项目真相
- 目标项目 `e956fe00-e242-40b1-b8cc-861bdd49c7f9` **已是完整 design system**：
  `components/{brand,controls,game}/`（BrandLockup / ModeButton / VerdictButton / ResultBadge /
  CommanderCard / FactorFrame / MapThumb / MatchRow，每个含 `.d.ts/.jsx/.prompt.md/.card.html`）
  + 真身 `assets/{borders,commanders,factors,logos,maps}/` + `foundations|tokens|styles.css`
  + `guidelines/*.card.html` + `ui_kits/jjb/` + `_ds_bundle.js` + `_ds_manifest.json`。
- 即：**已被完整 sync 过一轮**，非首次建基线。`_ref/` 临时图已被成品取代。

## 形态判断（关键，别误跑转换器）
- JJB 是 React/Vite **应用**（`web/`），不是发布的 design-system 包，也无 Storybook。
- 上一轮 sync 是 **off-script 手工路径**：从 `web/src/components/` 真实组件改写为 DS 格式。
- **没有 deterministic 转换器路径**（`package-build.mjs` 期望 `dist/` 导出 `window.<global>.*`，JJB 不满足）。
- 后续"继续 sync" = **手工增量更新**受影响的少数组件，不是重跑脚本。

## 路由
- 项目非空 + 本地此前无 pin → 按 skill §1 = **atomic / re-adoption path**（跑完一次性更新，更新前需提示覆盖风险）。
- 本文件已补上 `config.json` 的 `projectId` pin，下次走 pinned→atomic，确定可复现。

## 待办：等双打 round 收口再增量
- 双打 round（marker `jjb-r4-doubles-feiqiu`）正在改 `web/src/screens/HomeScreen.tsx`：
  第五格 `suiji→feiqiu`（非酋·飞球）、第六格 `doubles` 接通（去 soon）。
- 影响 DS 里的 `components/controls/ModeButton`（第五/六格文案与态）+ 可能新增 doubles 屏。
- **其余组件（CommanderCard/FactorFrame/MapThumb/MatchRow/Brand）不受双打影响，已是最新，无需重传。**
- 结论：现在重跑只会传一份马上过时的 ModeButton，且撞双打半成品工作树。
  **正确做法 = 双打 round gate 全过并合并、工作树干净后，手工增量更新 ModeButton（+ doubles 屏若有），其余不动。**

## 部署旁注（非 design-sync，但同期真相）—— docker 持久化已达成
- 开发机 `10.37.220.128`：Docker 早装好（18.09，7 容器在跑，daemon `is-enabled=enabled`），
  外网受限（Docker Hub 不可达、公司 `hub.byted.org` 无 nginx、本地 macOS arm64 灌 x86_64 报 `exec format error`）。
- **破局关键**：本地 `docker pull --platform=linux/amd64 nginx:1.27-alpine` →
  `docker save --platform linux/amd64 ... | ssh devbox docker load`（强制导出 amd64，绕开开发机外网）。
- 服务：`docker run -d --name jijiebei-nginx --restart=always -p 8080:80 -v ~/jijiebei-deploy/web/dist:/usr/share/nginx/html:ro nginx:1.27-alpine`。
- 真持久化：docker daemon enabled + 容器 restart=always → 机器重启/进程崩溃均自愈。实测外部 IP 200/0.38s、RestartCount=0。
- dist 来自 clone 的干净基线 5f9380c（不含双打半成品）。双打 round 合并后需 rebuild+重挂 dist 才更新线上。

## 2026-06-20 随机敌方实现 + design-sync 适用性复核（重要）

- **/design-sync skill（组件库高保真转换器）对 jjb 不适用，本轮未跑**：再次确认上文「形态判断」——jjb 是 React/Vite **应用**、非组件库 package、无 Storybook，`package-build.mjs` 期望 dist 导出 `window.<global>.*` 不满足。本轮 yb 调 `/design-sync`，hub 判定**不盲跑重型转换器**（几小时 + 大 token + 会卡在 package shape），改走「手工增量 + Playwright 验收」。**下次再调 `/design-sync` 同样不跑自动转换器**，要么手工增量推个别组件、要么只做 Playwright 验收。
- **随机敌方功能已实现落 repo**（web 侧，对齐云端 `e956fe00` 的 `proposals/random-enemy/01,02` 设计稿）：
  - 数据 `web/src/data/aiEnemyPool.ts`（19 种 AI + 种族 P/T/Z，id=race 前缀消歧 GroundClassic/AirClassic）
  - 逻辑 `web/src/logic/{randomConfig(全局开关), aiEnemySelector(直接随AI+per-match状态)}`
  - 门面 `jjbView.currentEnemyRace/Ai`；接线 `jjbSession.toStartCore` + `jjbDoubles.doublesStart/Reset`
  - 渲染 `components/EnemyBadge.tsx` + 接 MatchRow/ObsBar/Select/Battle/Obs/BpConfig + `styles/random-enemy.css`
  - e2e `web/e2e/random-enemy.mjs`（6 项 PASS）；tsc/build/三套回归全绿
- **race 印花真图待入库**：云端 `e956fe00` 的 `assets/races/race-{protoss,terran,zerg}.png`（各 ~6KB）需落 `web/src/assets/races/`。**base64 无法经模型手抄落盘（会损坏，实测截断过）**，须走 handoff tar.gz（curl 落盘不经模型）或 yb 直接给文件。落盘后 `realAsset.raceUrl` 的 glob 自动命中替换文字徽章兜底，零改代码。
- 云端 `e956fe00` 设计稿已提炼到 repo `design/random-enemy/SPEC.md`（完整 html 留云端可 get_file 重读）。

## 2026-06-23 账号迁移 + e956fe00 404（重要）
- **旧 Claude 账号被封**，新账号 maura.woodellis（`/design-login` 授权）。`DesignSync get_project e956fe00` = **404 not found**——旧设计系统项目随旧账号丢失，19b54387 Prototype 同丢（`list_projects` 返空 `[]`）。
- 账号数据导出（`~/Downloads/data-91b6999d-…batch-0000`）只有 1 个 starter 项目「How to use Claude」+ 20 个 design_chats 对话历史，**无 e956fe00/19b54387 完整项目结构**，从对话重建不值（产物已在 repo）。
- **再次确认不跑 /design-sync 自动转换器**（NOTES 上文判定 + 本次探测：`web/src/components` 9 组件虽 0 耦合 logic，但 jjb 整体仍是应用非组件库、无 storybook、`package-build.mjs` 不满足）。yb 本次手动 `/design-sync`，hub 据 NOTES + 404 判定不盲跑。
- **设计真相在 repo**：A–G 七屏（除 F 登录）的 css(bp/obs-name/ladder/code-scheme/random-enemy + 三皮肤 token) + React 实现完整，不依赖丢失的云端 DS。F 登录走轻量（新账号 Prototype 手工 off-script，或 hub 直接按 repo 设计语言实现），不重建旧 DS。

## 2026-06-23 design-sync 在新账号重建成功（fd3ab5f6 · 5-agent workflow 调研 + spoke off-script + hub 亲验）
- **converter 不可行的精确根因**（workflow 实锤，更正上文「形态判断」表述）：converter esbuild **不认 import.meta.glob**(Vite-only 语法)。jjb 9 组件 6 个(CommanderCard/BrandLockup/EnemyBadge/FactorFrame/MatchRow/ObsBar)经 realAsset.ts/designAssets.ts 用 glob → esbuild bundle 后浏览器 `import.meta.glob is not a function` 崩。synth-entry fallback 存在(web/package.json main/module/exports 全 undefined → 合成 .pkg-entry.mjs)但被 glob 崩断；要跑 converter 须自写 Vite-glob esbuild plugin(数小时)。→ NOTES 旧判断"不跑转换器"**结论对**，真根因是 glob 非 window-global。
- **本轮 off-script 手工增量**(spoke jjb-dsbundle·GLM-5.2·harness round 真 native review)：同步 3 个有真实变更的组件 —— controls/ModeButton(双打5/6号位非酋之轮·官突双打)、game/EnemyBadge(随机敌方三族印花，race 真图**已在** web/src/assets/races/ 非待入库)、game/ObsBar(横条三修)。CommanderCard/FactorFrame/MatchRow/BrandLockup 不动(已最新)。
- **glob props 化**绕 esbuild 崩：raceUrl/cmdUrl/facUrl/mapUrl 改传预解析 URL，race png 复制进 ds-bundle/assets/races/；grep import.meta.glob ds-bundle/_ds_bundle.js = **0**。
- **CSS 闭包** styles.css @import 次序(Google Fonts 置顶→design/v4-r2 theme/styles/v4/obs→本地 brand-gold/obs-fuller/jjb-select→功能层)，design/v4-r2 css 复制进 ds-bundle/css/(平铺无相互 @import)；token 26 defined，accent #D8B15A 生效。
- **hub 亲验**：package-validate 格式全过(唯一 [RENDER_SKIPPED] 因 .ds-sync 缺 playwright，非产物问题) + hub web playwright 验 3 组件×三皮肤渲染(root非空+无glob error+token生效) + **抓修 ModeButton [GRID_OVERFLOW]**(.ds-grid 360px 并排→改单列三皮肤纵向全宽)。32 文件 DesignSync 上传 fd3ab5f6，list_files 确认。
- **pin 更新** config.json projectId e956fe00(404)→fd3ab5f6；ds-bundle/.ds-sync/ 已 gitignore。**下次同步**：list_files fd3ab5f6 已有 3 组件，增量补 CommanderCard/FactorFrame/MatchRow/BrandLockup 或新组件；converter 仍不可用(glob)，继续 off-script + hub Playwright 验。

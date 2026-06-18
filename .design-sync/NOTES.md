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

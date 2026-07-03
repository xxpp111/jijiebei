# 集结杯 · 渲染架构 & 协作分工

> 来源：飞书画板「集结杯单刷 · 渲染架构 & 工具分工」（画板 token `G2YZw0hZvhRhqVbWjZucZ8m7nGe`，内嵌于 docx <https://bytedance.larkoffice.com/docx/KMIodWA5Wo9L6exPkXYc6D4AnJh>），本地同源 `design/README.md` + `design/v3/project/spec.jsx`。
> 本文 = 原画板转录 + **协作分工更新到现行模式**。原画板停在 2026-06-08，把工程画成"Opus 自组装"，未含 Claude Code 工程角色——本文已更新，见第四节差异说明。

## 一、渲染架构：每屏 = `danshua.fire` 4 层节点叠出来

实测 `danshua.fire`，每个界面由 4 层节点叠成，这决定了各工具的分工边界：

| 层 | 内容 | 现状 | 谁负责 |
|---|---|---|---|
| ① 静态美术整图 | `images/bg/`：背景1.jpg 1280×720（全屏底）、标题横幅（待换）、背景2 / 群号 / mask 压暗 | 整图、无字 | **GPT-image-2** 出无字整图，文字另用 Label 叠 |
| ② 控件「占位」视觉 | 按钮 / 槽位 / 面板底 = `singleColor` 纯色块拉伸；胜利/失败/开始 = 默认 Cocos 按钮；选手框 = 默认 EditBox；lock = 锁图标 | ⚠️ 几乎无 UI 美术，全是纯色块凑的——正好整套重做 | **Claude Design** 出整套样式 → **Claude Code** 在 Cocos 实现 |
| ③ 动态游戏图标 | 运行时 URLSprite 加载：指挥官 60×60 / 地图 200×70 / 因子图标；星际2 既有美术 | 既有素材 | **既有素材不动**，设计围着固定尺寸排版 |
| ④ 文字 Label | 标题 / 模式名 / 选手 / 胜负 / 获胜X场；⚠️ mode/players/result 框仅 103×50 → 文字易溢出 | Cocos Label | **Claude Design** 定字号层级 → **Claude Code** 实现 overflow |

## 二、责任方分工（现行 4 方）

| 方 | 负责 | 产出 |
|---|---|---|
| **Claude Design**（claude.ai/design 云端，**最大块**） | ②控件 + ④文字 的整套样式 / 布局栅格 / 配色（navy + 金 + 银）/ 字号层级 + 组件结构 | handoff（HTML/CSS/React/data.js，入 git） |
| **GPT-image-2**（ModelHub 直连） | ①静态整图：集结杯背景 + 标题横幅（换掉旧「回归杯」艺术字）+ 可选底纹，无字 | 整图素材 |
| **Claude Code**（工程，本 hub + 可派 spoke） | 据 handoff 在 Cocos 重实现（**非网页直接用**）；改后端规则逻辑（jjbDesign 前端 hub 直接改 / jijie2 给 yb patch，红线不碰）；顺带定"需要哪些整图、各多大"给 GPT-image-2 | jjbDesign 代码、build 产物 |
| **既有游戏素材** | ③指挥官 / 因子 / 地图图标，星际2 既有美术 | 不动 |

## 三、协作落地 pipeline（已更新到现行模式）

**视觉 / UI 流：**
1. Claude Code(hub) 写设计 prompt + 备资源 → **Claude Design** 出整套设计骨架（样式 / 布局 / 配色 / data.js）
2. **GPT-image-2** 出无字整图（背景 / 标题横幅）
3. **Claude Code** 据 handoff 在 Cocos 翻译实现（节点 + Label + Sprite，不直接用网页）
4. **build web-mobile + 截图** → hub 终验 → 反馈进下一轮

**后端 / 规则 流（原画板未覆盖，现行新增）：**
1. 梳理规则真相（见《模式规则真相表》mode-rules-truth-table.md）→ yb / 土豆 校对
2. **Claude Code** 翻译成代码：jjbDesign 前端 hub 直接改；jijie2 后端给 yb patch（红线不碰）

## 四、与原画板（2026-06-08）的差异（入库须知）

- 原画板第③步「我(Opus) Cocos 组装」→ 现行明确为 **Claude Code 工程角色**（设计与工程已拆分：设计→Claude Design / 工程→Claude Code）。
- 原画板只覆盖 UI 渲染，**未覆盖后端 / 规则流**；现行加了后端 / 规则这条流（jijie2 规则对齐、因子 / 指挥官抽取、降权等）。
- 若要更新飞书画板原图，建议拆成两张：「渲染架构（4 层）」保留 + 「协作分工 pipeline」更新到现状；不要和"人类三方赛事协作"（土豆 / XP / yb，见三方对齐文档）混到一张图。
- 全盘（飞书 + 本地）**只有这一张 AI 工具链流程图**；"赛事 / 选手运营流程"（报名→抽签→对战→导播→结算）目前不存在。

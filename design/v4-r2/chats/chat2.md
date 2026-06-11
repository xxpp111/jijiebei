# OBS底部横条设计

_Started 2026-06-11 16:18 UTC_

---

## User

① 对战页确认 OK，定稿冻结。补充事实：① 已完成 Cocos 工程复刻并通过全部验收
（6 主题截图、行级态、回归全绿），后续不回改。

现在开 ② OBS 底部横条（重点块），按 brief 硬标准执行：
- 1280×200~240 专用形态；所有文字与图标以「缩至 1/3 仍可读」为硬标准；
- 内容 = 三场（地图缩略 + 双指挥官卡 + 带框因子 + 状态徽章[胜利/进行中/待战/带奖励/失败]）
  + 大比分 + 当前场次强调；
- 信息优先级：当前进行场次 > 比分 > 各场阵容；
- 6 主题 token 沿用（①已定稿的边框/卡片体系直接复用），正文对比度 ≥4.5:1。

交付照例：设计画布 + 规格板（状态矩阵/尺寸/动效/Cocos 2.4 程序化要点）
+ _review 纵排审查页。完成后停下来给我确认再进 ③ 二选层。

## Assistant

_[tool: list_files]_

I'll start by exploring the existing project files to understand the finalized ① design system (tokens, border/card system, 6 themes) that I need to reuse.

_[tool: read_file]_

_[tool: read_file]_

Let me read the core design system files to understand the finalized ① system.

_[tool: read_file]_

_[tool: read_file]_

_[tool: list_files]_

Now let me look at the design canvas structure, the review page pattern, and assets so I match the existing delivery conventions.

_[tool: list_files]_

_[tool: read_file]_

_[tool: read_file]_

Let me look at the key components — the battle screen, the spec board pattern, and the main design canvas HTML, plus v4.css.

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

Now let me read the component definitions (CC/FX/MatchRow/VBtn/SpecBoard) and the main canvas HTML to fully understand the building blocks.

_[tool: read_file]_

_[tool: view_image]_

Let me read select-screen.jsx (CC/FX/CtrlBar definitions) and view the current battle screen render to ground my visual decisions.

_[tool: list_files]_

I now fully understand the finalized ① system. Let me check the input folder (factor border PNGs) and confirm the score semantics, then plan.

_[tool: update_todos]_

Design context is fully absorbed. Let me set up the plan and commit to a system.

_[tool: write_file]_

**System I'm committing to** (② OBS 底部横条 · 重点块):

- **Form**: 1280×224 opaque themed lower-third + top accent hairline. Single horizontal row — fits the 200–240 budget.
- **Layout**: left **score rail** (brand · 大比分 1/3 · 3-pip series strip) → 3 **match columns** in one row. The live column is wider (flex 1.5) + accent ring = 当前场次强调.
- **Each column**: head (第N场 · 双打 · 状态徽章) / 地图缩略名牌 / 双指挥官卡 + 带框因子.
- **5 status badges**, color-coded: 胜利=win · 带奖励=bonus · 失败=lose · 进行中=accent+pulse · 待战=outline. Color carries meaning at 1/3; text confirms up close.
- **1/3 hard standard**: big type, chunky icons, color-first badges, names only on the live column (compact = portrait-only), large score — plus a dedicated 缩放校验 proof.
- **Border/card system**: reuses ①'s frozen language (metal切角 / sc2角刻线 / minimal圆角 + live = `.match-active` accent ring), scoped to `.obs-match`. No edits to frozen ① files.

Writing the CSS:

_[tool: write_file]_

Now the OBS bar component:

_[tool: write_file]_

Let me do a quick render check of the bar before building the spec boards and full canvas.

_[tool: show_html]_

This is a mid-build verification, not a deliverable yet. Let me capture the render.

_[tool: show_html]_

_[tool: save_screenshot]_

_[tool: save_screenshot]_

_[tool: sleep]_

_[tool: save_screenshot]_

_[tool: show_html]_

_[tool: get_webview_logs]_

_[tool: save_screenshot]_

_[tool: eval_js]_

The screenshot tool needs a settled preview. Let me inspect via eval_js to verify layout dimensions and no overflow.

_[tool: str_replace_edit]_

Overflow detected — live cell factors wrap to a 2nd row. Let me tighten sizing and bump the bar to 232px (within budget).

_[tool: str_replace_edit]_

_[tool: show_html]_

_[tool: eval_js]_

_[tool: save_screenshot]_

No overflow now. Let me get a visual via save_screenshot.

_[tool: str_replace_edit]_

Rendering well. But the map thumbnails already have the map name baked into the artwork — my overlaid `.obs-map-name` duplicates it and overlaps. Let me remove the overlay, and adjust the test to view full 1280 bars at fit-scale.

_[tool: str_replace_edit]_

_[tool: show_html]_

_[tool: save_screenshot]_

_[tool: sleep]_

_[tool: save_screenshot]_

_[tool: save_screenshot]_

_[tool: multi_screenshot]_

_[tool: show_html]_

_[tool: sleep]_

_[tool: save_screenshot]_

_[tool: write_file]_

Screenshots are environmentally flaky right now (one captured cleanly earlier, confirming the design is solid). I'll proceed building and lean on the verifier's own iframe at the end, using eval_js for layout checks meanwhile. Now the spec boards:

_[tool: write_file]_

Now the design canvas:

_[tool: write_file]_

Now the vertical review page:

_[tool: update_todos]_

Let me verify the review page renders cleanly and check spec board overflow.

_[tool: show_html]_

_[tool: get_webview_logs]_

_[tool: eval_js]_

_[tool: save_screenshot]_

All clean — 8 bars no overflow, 4 spec boards, no missing images. Let me try a visual capture of the review page.

_[tool: sleep]_

_[tool: save_screenshot]_

_[tool: show_html]_

Capture backend is unavailable this session, but eval_js confirms clean layout. Let me verify the actual deliverable (the canvas) mounts correctly.

_[tool: eval_js]_

_[tool: delete_file]_

All 4 sections and 14 artboards mount, no errors. Let me clean up scaffolding and hand off.

_[tool: done]_

_[tool: fork_verifier_agent]_

② **OBS 底部横条（重点块）** 已按 brief 硬标准交付，停下来等你确认再进 ③。

**形态**：1280×232（200~240 区间），单行不折，透明根节点可直接做 OBS 浏览器源。

**信息优先级落位**（当前进行场 > 比分 > 阵容）：
- 左·分数轨 = 品牌 + 大比分（已胜/总）+ 三段局分 pip
- 右·三场列 = 当前进行场做 **hero**（加宽 flex 1.52 + accent 包边 + 字号/因子放大 + 进行中脉冲徽章），其余两场紧凑
- 每场 = 地图缩略 + 双指挥官卡 + 带框因子 + 状态徽章

**五态徽章**：胜利 / 带奖励 / 失败 / 进行中 / 待战 —— **色彩为第一载体**，文字近距确认，故缩至 1/3 仍能凭色辨胜负。

**硬标准兑现**：
- 边框/卡片体系直接复用①已冻结语言（金属切角 / 星际2 角刻线 / 极简圆角 + `.match-active` 包边），作用域收到 `.obs-match`，**未改①任何文件**
- 正文字号 ≥12，状态色对比 ≥4.5:1
- 专设「缩放校验」段，100→50→33%（427px 基准）可读性自证；紧凑场仅留头像识别、hero 场保留指挥官名以避免缩放糊噪

**交付**：
- `② OBS底部横条.html` — 设计画布（6 主题 + 缩放校验 + 全场判定态 + 规格板）
- `_review-obs.html` — 纵排审查页
- 规格板四块：分区落位 / 状态矩阵 / 尺寸族·1/3 校验 / 动效·Cocos 2.4 程序化要点

> 注：本轮截图后端不可用，已用 DOM 实测校验（8 横条零溢出、图片全加载、14 画板与 4 规格板正常挂载），并派了核查代理复看视觉。你确认后我再开 ③ 二选层。

## User

Found issues — fixing…

## Assistant

_[tool: str_replace_edit]_

Good catch — the note cells inherit `white-space: nowrap` from `.mx-rowlab`, blowing out the 5-col grid. Adding `whiteSpace: normal`:

_[tool: show_html]_

_[tool: eval_js]_

_[tool: done]_

Fixed — status-matrix board now 980px = clientWidth, zero overflow; all 4 boards clean. The fix lives in shared `spec-obs.jsx`, so both the canvas and review page are corrected.已修复，无控制台报错。

**改动**：状态矩阵的注释格沿用了 `.mx-rowlab` 的 `white-space: nowrap`，撑爆 5 列网格 → 改为 `whiteSpace: normal` 允许换行。DOM 实测四块规格板 scrollWidth = clientWidth，零溢出。修复在共享的 `spec-obs.jsx`，画布与审查页同步生效。

② 定稿待你确认。确认后我开 **③ 二选层**。


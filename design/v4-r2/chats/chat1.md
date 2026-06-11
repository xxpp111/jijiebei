# 集结杯直播工具设计

_Started 2026-06-10 18:44 UTC_

---

## User

这是「集结杯 × CM」比赛直播工具 v4 细节修缮的 R2 轮设计任务，新项目接力。

R1（选择面板：游戏风格边框系统+全局控制条+校验toast）已在上一个项目定稿并进入工程复刻——本包里 r1-final-select-*.png 三张是定稿整屏，r1-notes.md 是设计要点权威记录（边框/角标/控制条/动效时长表），r1-*.css/jsx 是全部源码。R2 的一切设计必须沿用 R1 已定稿的设计语言，不要重新发明。

请先读 r2-design-brief.md（含本包全部 39 个文件的清单说明），然后按顺序出三块设计：
①对战页边框落位（现状 current-battle-doubles-sc2-dark.png）
②直播浮层 OBS 底部横条 1280×200~240（重点！缩至 1/3 仍可读，现状全屏版 current-overlay-fullscreen-*.png）
③「手选阵容/随机抽签」二选层正式化（现状 current-dialog-pathchoice-*.png）

约束：6 主题 token 体系（r1-theme.css/styles.css/v4.css）、1280×720 基准、最终 Cocos 程序化复刻、规格板照 R1 的 spec 格式（状态矩阵+尺寸族+动效+Cocos 落地要点）、附 _review.html 式纵排审查页。每完成一块停下来给我确认再继续。

## Assistant

_[tool: local_ls]_

I'll start by exploring the input folder to understand the full scope.I'll read the brief first, then the R1 authoritative notes.

_[tool: local_read]_

Now the authoritative R1 notes.

_[tool: local_read]_

Now let me look at the three R1 final screenshots (the visual baseline) and the three current-state screenshots.

_[tool: view_image]_

_[tool: view_image]_

_[tool: local_copy_to_project]_

These are local files — I need to copy them into the project first to view them. Let me copy the key reference images and source files.

_[tool: view_image]_

_[tool: view_image]_

_[tool: view_image]_

_[tool: view_image]_

I have a clear picture of the R1 design language. Now the minimal-light variant and the three R2 current-state screenshots.

_[tool: view_image]_

_[tool: view_image]_

_[tool: local_read]_

Now let me read the R1 source code to understand the exact token system and component patterns I must reuse.Now the theme.css for tokens, and styles.css.

_[tool: local_read]_

_[tool: local_read]_

Now styles.css for theme tokens, and the JSX components.

## User

继续

## Assistant

_[tool: local_read]_

Let me read the JSX components — the select screen (for FX/CC patterns) and the spec boards (for the spec format I must match).Now the spec board format. Let me read the impl spec (most relevant — has CtrlStates + ImplSpec + Cocos format).

_[tool: local_read]_

Now the factor and cmd spec boards for the SpecBoard pattern and matrix format.

_[tool: local_read]_

_[tool: local_read]_

_[tool: update_todos]_

I now have a complete understanding of the R1 system. Let me set up the project structure — copy assets and the three CSS files, mirroring R1's layout so relative paths resolve.

_[tool: local_copy_to_project]_

Now copy the three CSS files and the two reusable JSX components (which provide FX/CC/CtrlBar/SpecBoard) into the v4 folder.

_[tool: copy_files]_

_[tool: delete_file]_

_[tool: local_copy_to_project]_

_[tool: image_metadata]_

_[tool: image_metadata]_

Let me verify the border asset dimensions, then build block ①.

_[tool: copy_starter_component]_

All assets in place. Let me get the design canvas starter for the main deliverable.

_[tool: str_replace_edit]_

Now let me extend the R1 `CtrlBar` to support the active screen (backward-compatible), then build the battle screen.

_[tool: read_file]_

Now append the battle-page CSS (border placement adjustments) to v4.css.

_[tool: str_replace_edit]_

_[tool: write_file]_

Now the battle screen component.

_[tool: write_file]_

Let me build a quick test render of the battle screen to verify layout before assembling the full deliverable.

_[tool: show_html]_

_[tool: show_html]_

_[tool: save_screenshot]_

_[tool: save_screenshot]_

_[tool: show_html]_

_[tool: save_screenshot]_

_[tool: get_webview_logs]_

_[tool: save_screenshot]_

Page renders clean. The screenshot environment is flaky (as R1 noted). Let me retry.

_[tool: str_replace_edit]_

Borders, tags, and cards render correctly. The viewport only captures the top-left — I'll scale the page down to review the full 1280 width (per R1's zoom-review approach).

_[tool: show_html]_

_[tool: save_screenshot]_

_[tool: save_screenshot]_

_[tool: str_replace_edit]_

The sc2-dark battle reads beautifully — borders, 官突 tags, 进行中 pulse, win state, verdict balance all working. One bug: the 双打 badge wraps vertically. Let me fix that and check the other themes.

_[tool: str_replace_edit]_

_[tool: show_html]_

_[tool: save_screenshot]_

_[tool: str_replace_edit]_

metal-dark is excellent — chamfered rows, gold accents, 双打 on one line now. Let me verify the light mode (minimal-light) renders cleanly.

_[tool: show_html]_

_[tool: save_screenshot]_

_[tool: write_file]_

All three styles × both modes render cleanly. The battle border placement is solid. Now let me build the spec boards (R1 format) for the battle page.

_[tool: read_file]_

Now let me check the design canvas component API before assembling the deliverable.

_[tool: write_file]_

Now assemble the main deliverable — the design canvas with battle screens + spec boards.

_[tool: show_html]_

_[tool: get_webview_logs]_

_[tool: save_screenshot]_

_[tool: write_file]_

Design canvas works (pannable at 1:1). Now the vertical review page for engineering screenshots — stacking all 6 theme variants + spec boards at 1:1.

_[tool: show_html]_

_[tool: get_webview_logs]_

_[tool: write_file]_

Let me verify the spec boards render correctly (content fit, no clipping) with a zoomed capture.

_[tool: show_html]_

_[tool: save_screenshot]_

_[tool: str_replace_edit]_

The anatomy board is too narrow — the real battle row needs ~1200px and wraps at 920. Let me widen just that board to fit a 1:1 row.

_[tool: str_replace_edit]_

_[tool: show_html]_

_[tool: save_screenshot]_

_[tool: str_replace_edit]_

Still wrapping by a few px. Let me give it more room — board 1300, tighter wrapper padding.

_[tool: str_replace_edit]_

_[tool: show_html]_

_[tool: save_screenshot]_

_[tool: save_screenshot]_

_[tool: str_replace_edit]_

Boards a & b look clean. Let me verify the sizes and impl boards (below the fold).

_[tool: show_html]_

_[tool: save_screenshot]_

_[tool: delete_file]_

All four spec boards verified — clean and dense, matching R1. Block ① is complete. Let me clean up temp files and surface the deliverable.

_[tool: update_todos]_

_[tool: done]_

_[tool: fork_verifier_agent]_

Block ① 完成，停下来等你确认。

## ① 对战页 · 边框落位

**做法**：把 R1 已定稿的 `.cc` 指挥官卡 / `.fx` 因子框直接接入对战行，行容器·切角·判定按钮全部沿用 `theme.css` 既有 `.match·.verdict`，**没有重新发明**——只补了两个行级状态。

**落位要点**
- **因子** → 56×56 绿框/金框；`官突`=实底 accent 角标、`锁定`=深底金字角标（沿用 R1）
- **指挥官** → 58×70 R1 指挥官卡含名牌；**双打=并排两张**（gap 9，124px 宽）
- **地图**较 select 收窄 40px（250px）给双打阵容让位；因子区 `flex+wrap`，5 枚单行容得下
- **判定三按钮样式不变**，但核对了与新边框的平衡：按钮高度拉到与卡齐平（70），未选态描边加重一档，避免被边框抢焦点
- **新增行级态**：`进行中`=accent 包边+脉冲徽标（仅当前场）；`已判定`=整行 82% 降权
- **控制条**与 R1 select 一致（`对战`高亮，直播中可收起为把手）

**交付物**（都在 `v4/` 下）
- `对战页边框 v4.html` — 设计画布：4 块整屏（星际2暗/金属暗/极简亮/收起态）+ 4 张规格板（分区落位·状态矩阵·尺寸族·动效Cocos）
- `_review-battle.html` — 纵排审查页：6 主题整屏 + 收起态 + 4 规格板，1:1 便于工程逐屏截图

**一处自决**：地图缩略图双打档收窄到 250px（理由：双打要塞两张指挥官卡+5 因子，原 290px 会把因子挤到折行）。

确认这块 OK 我就继续 **② OBS 底部横条**（重点块）。要调整的地方现在说。

## User

Found issues — fixing…

## Assistant

_[tool: str_replace_edit]_

Real specificity bug — the theme rules override the base `.match-active`. Let me replace it with per-theme high-specificity overrides for all 6 combos, each restating the accent ring combined with that theme's own shadow.

_[tool: show_html]_

Now let me verify the fix across themes by checking computed styles on the active rows.

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: fork_verifier_agent]_

Fixed and verified — all 6 themes now render the accent ring on the active row. Let me re-run the verifier to confirm clean.

_[tool: done]_

_[tool: fork_verifier_agent]_

已修复。验证器发现的是真实的 CSS 特异性 bug：基础 `.match-active` (0,2,0) 被 styles.css 里各主题的 `.match` 阴影 (0,3,0) 盖掉，所以只有 metal-dark（已有显式覆盖）有 accent 圈，sc2/minimal 没有。

**修法**：给 6 个主题各写一条 (0,4,0) 的 `.style-X.mode-Y .match.match-active`，每条把 accent 包边和该主题自己的内阴影/落影合并重申。已逐一用 `getComputedStyle` 验证——**6 主题全部 ACCENT-RING ✓**。

①这块现在干净了。确认 OK 我就开 **② OBS 底部横条**（重点块）。


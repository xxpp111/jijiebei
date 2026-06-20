# 随机敌方 — Claude Design 设计规格（同步自云端 e956fe00）

> 设计真相源：claude.ai/design 项目「集结杯 Design System」`e956fe00-e242-40b1-b8cc-861bdd49c7f9` 的
> `proposals/random-enemy/{01-master-toggle,02-enemy-block}.html`。完整 html 留云端（可随时 DesignSync get_file），
> 本文是**实现规格提炼**。同步于 2026-06-20。

## 核心：印花即种族
敌方 = **种族**（印花徽记）+ **AI 敌军组合**（中文名）。用一枚官方种族印花叠在地图右上角表种族，**不另用色块**。
素材见 `assets/races/race-{protoss,terran,zerg}.png`（神族/人族/虫族）。

## Block 1 — 总开关
- **拨钮样式**：金棕拨钮 + 金棕描边 + 微辉光 = ON；钢蓝拨钮 + 灰描边 = OFF。金属斜切角(chamfer)，对齐 BP 每模式开关。尺寸大 58×28 / 小 `.sm` 50×24。
- **放置（结论：A + B 都要）**：
  - **A 主控（推荐）**：并入 BP 设置面，**独立金棕描边分区** `.bp-enemy`，与每模式 BP 列表视觉分隔（它是全局开关，不混进模式列表）。文案「每场随机敌方 · 每场对局自动随机种族与 AI 敌军组合」。
  - **B 镜像（附加）**：select 屏顶部快捷开关 `.quick`，实时同步 A，临场可切。
- **状态**：ON 每场自动随机；OFF 敌方块整体不显示、不占位。

## Block 2 — 敌方信息块（`.menemy`，叠地图右上角）
- **结构**：种族印花 img + (`rk`「敌方」小标) + `nm` 组合名。深色半透底 + 金属斜切；地图名在左下，互不遮挡。
- **三档尺寸**：
  - select 大卡（≈360px）：`.menemy` 印花 30px + 「敌方」标 + 名。
  - battle 中卡（≈1040px）：`.menemy.md` 印花 28px。
  - **OBS 小卡**（1280×232）：`.menemy.sm` 印花 **23px、省「敌方」二字、只留印花 + 名**，clip 更小。
- **不增卡片高度、不挤占指挥官 / 因子 / 判定。**
- **OFF**：印花块整个不出现，地图回原样，三档一致。

## 种族印花素材（真相在云端 e956fe00 `assets/races/`）
3 枚印花 png 已确认存在、各约 6KB（PNG 透明底）：
- `race-protoss.png` 神族 PROTOSS（8 套组合）
- `race-terran.png` 人族 TERRAN（6 套组合）
- `race-zerg.png` 虫族 ZERG（5 套组合）
> 实现时（task #28）直接 `DesignSync get_file` 落到 web 渲染位置（`web/public` 或 `web/src/assets`，**非 assets/resources 红线**），不在 design/ 中转、不手抄二进制。

## 实现接入（对应 plan「代码侧预案」）
- race png → web 渲染印花（实现时放 `web/public` 或 `web/src/assets`，**非 assets/resources 红线**）。
- `.menemy` → `MatchRow`/`ObsBar`/`SelectScreen` 的地图缩略图容器内**绝对定位右上角**，按 select/battle/obs 切 默认 / `.md` / `.sm`。
- 开关 → `BpConfigScreen` 加 `.bp-enemy` 分区 + `SelectScreen` 顶部 `.quick` 镜像，状态由 `randomConfig` 驱动。

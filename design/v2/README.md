# design/v2 — Claude Design v2 handoff 落地归档

## ⚠️ 归档说明（诚实标注）

v2 handoff 原始分享链接（`https://api.anthropic.com/v1/design/h/lVdPNi97VJD6lN1gp31__Q`）为**一次性链接，现已失效（404）**，落地时未存档原始导出（HTML/CSS/jsx/data）。

本目录据 v2 **实际落地实现**重建设计基线（规格 + 落地映射 + 标题生成脚本），供对照 [v1](../v1/) 与后续改稿。**若需原始 web 稿**，请从 Claude Design 重新导出后替换本目录（流程见 [../README.md](../README.md)）。

## v2 相对 v1 的设计变更（已落地 `assets/Script/jjbDesign/`）

### 1. 标题艺术字「集结杯」6 套（皮肤 × 明暗）
PIL 垂直渐变（top→bot）+ 可选描边/阴影；生成脚本见本目录 [`gen-titles.py`](./gen-titles.py)。round-2 微调后精确色值：

| 皮肤-明暗 | 主色 bot | top（高光） | 描边 | 字体 |
|---|---|---|---|---|
| metal-dark | `#c79a3e` | `#f0d890` | `#3a2c10` sw3 + 阴影 | 宋体衬线 |
| **metal-light** | **`#2f2105`** | `#624612` | 浅金 `#d6b678` sw1 | 宋体衬线 |
| sc2-dark | `#46c882` | `#78e6a0` | 无 + 阴影 | 黑体 |
| **sc2-light** | **`#123a26`** | `#1e5236` | 无 | 黑体 |
| minimal-dark | `#cdd2da` | `#f1f3f6` | 无 | 黑体 |
| minimal-light | `#10141c` | `#202630` | 无 | 黑体 |

落地：`assets/resources/images/brand/jjb-title-{style}-{mode}.png`；各屏按 `jjb-title-{style}-{mode}` 加载。

### 2. 亮色 logo
metal/sc2/minimal 各一张亮色版 `logo-cm-{style}-light`；`JJBData.markFor(style,mode)` 在 light 取亮色版。

### 3. 网格 HUD 背景（弃 v1 写实大图）
`JJBView.bg` 程序化：18 段渐变（bgA→bgB）+ 皮肤纹理（sc2 44px 网格 accent alpha15-20 / metal 118° 斜纹 / minimal 无）+ 顶部光晕（dark）+ 7 层暗角；**overscan 2000×1160 纯色底**盖住宽屏 canvas 在 1280×720 之外露出的原场景背景。

### 4. 卡片/面板四角装饰
`JJBView.panel`：metal 切角 12 / sc2 四角 L 刻线（14px，2px，accent）/ minimal 直角。

### 5. 结算战绩卡放大
rcard 96px + 左侧胜负色条（胜绿/带奖励蓝/失败红）+ map 248×64 + facs 46 + badge 22px/900。

## 落地映射

| 设计要素 | 落地文件 |
|---|---|
| 背景/卡片/刻线/切角 | `JJBView.ts`（bg / panel / cornerTicks / cutBox） |
| 6 套 token（皮肤×明暗） | `JJBTheme.ts` |
| 标题/logo 路径选择 | `JJBData.ts`（markFor） |
| 各屏布局 | `JJBHome / JJBSelect / JJBBattle / JJBResult / JJBOverlay.ts` |
| 素材 | `assets/resources/images/brand/` |

提交：`78de115`（v2 落地：去旗标 + 6 标题 + 亮色 logo + 结算卡放大）、`d2262ee`（风格整改：网格 HUD + 四角刻线 + overscan）。

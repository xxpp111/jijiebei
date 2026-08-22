---
title: 集结杯 Claude Design 闭环 SOP
id: jijiebei/claude-design-loop
status: current
owner: jjb-hub
updated: 2026-08-22
applies_to: ["新一轮设计出稿/读稿/落地 web/src", "DesignSync 操作与坑位排查"]
replaces: []
evidence: ["design/（设计稿区）", "design/README.md（设计资产索引）", "memory jjb-claude-design-loop（闭环经验）"]
review_after: 2026-09-22
---
# 集结杯 Claude Design 闭环 SOP

> 适用范围：每一轮新设计的「云端出图 → hub 读取 → 落地 web/src」全流程。
> 真相源：本 SOP 由一次实证设计轮沉淀（2026-06-22 P1a 双模式 tab + jjb-sediment-r1 workflow）；`design/v4-r2/` 为设计落地真相，`assets/Script/jijie2/` 为规则权威，三条红线见末节附录。

---

## 0. 一图速记

```
claude.ai/design
  └─ 新建项目：选 Product prototype（高保真，不是 wireframe）
       └─ 顶部 Design system 下拉：绑定「集结杯 Design System」
            └─ prompt 设计（自动继承品牌组件 + token）
                 └─ 把【项目 URL】丢给 hub
                      └─ hub 用 DesignSync get_file 读 <Name>.dc.html + 配套 css
                           └─ 实现到 web/src（token 复用 / 量化防溢出 / element 截图核对）
```

口诀：**Prototype 出屏幕，Design System 出底座；设计必须落项目文件，hub 才读得到。**

---

## 1. 两类项目区分（先认清在哪建）

claude.ai/design 下有两种项目类型，用途完全不同，**新设计轮 99% 的情况建的是 Prototype**：

| 维度 | Design System（品牌底座） | Prototype（屏幕设计） |
|---|---|---|
| 内部类型 | design-system | `PROJECT_TYPE_PROJECT` |
| 定位 | 品牌底座 / 组件库 / token 仓 | 一块具体屏幕 / 交互原型 |
| 内容 | 颜色 token、字体、基础组件（按钮 / 卡片 / 名牌…） | 完整页面布局，引用 Design System 的组件 |
| 例子 | 「集结杯 Design System」= `e956fe00` | 「集结杯练习比赛切换」= `19b54387` |
| 何时动它 | 只有要扩/改品牌组件、新增 token 时 | 每一轮新屏幕设计 |

要点：
- **新屏幕设计 = 新建一个 Prototype**，在顶部把 Design system 下拉绑到「集结杯 Design System」，自动继承品牌组件与 token。
- **不要**为了一块新屏幕去改 Design System 项目本身——那是底座，不是画布。

---

## 2. DesignSync 能读两类（关键纠偏）

之前误以为 hub 的 DesignSync（claude_design 连接器）只能读 design-system 项目。**实证真相：Prototype 项目（type=PROJECT）同样可读。**

- `list_projects` —— **只列 design-system 项目**（Prototype 不出现在列表里，这是它的设计，不是 bug）。
- `get_project` / `list_files` / `get_file` —— **对 Prototype 项目同样工作**。

因此拿到 Prototype 的 `projectId` 后，直接：
1. `list_files` 看清楚有哪些 `.dc.html` 和配套 css；
2. `get_file` 逐个读内容落地。

> 推论：**Prototype 项目 URL / projectId 必须由用户手动给 hub**，因为 `list_projects` 列不出来，hub 无法自己发现。这是闭环里「把项目 URL 给 hub」这一步不可省的根因。

---

## 3. 正确闭环（分步 SOP）

### Step 1 · 在 claude.ai/design 新建 Prototype
- 新建项目，类型选 **Product prototype**（高保真交互），**不要选 Product wireframe**（低保真线框，落地价值低）。
- 顶部 **Design system:** 下拉切到 **「集结杯 Design System」** 完成绑定。绑定后设计稿会自动用品牌组件和 token。

### Step 2 · 用 prompt 做设计
- 按需求块逐块 prompt，每块完成停下确认（沿用 brief 顺序）。
- 设计稿里出现的精确值（间距 / u 系数 / 动效时长 / 百分比）即落地契约的 done-when 锚点，注意保留。

### Step 3 · 把项目 URL 给 hub
- 设计满意后，**复制该 Prototype 的项目 URL（含 projectId）发给 hub**。
- 这是闭环唯一的「人工交接」动作；不给 URL，hub 读不到（见 §2）。

### Step 4 · hub 用 DesignSync 读取设计文件
- hub：`get_project` 确认 → `list_files` 列文件 → `get_file` 读 `<Name>.dc.html` + 配套 css（如 `home-match.css` / `enemy.css`）。
- 读到的就是设计真身，无需再走导出。

### Step 5 · 实现到 web/src
- 按 `.dc.html` 结构（见 §4）把组件、布局、token 落到 `web/src`。
- token 直接 `var()` 复用（见附录），不照搬设计稿的占位简化（保 repo 真实可用状态），落地后用 element 截图 + 量化核对溢出（见附录）。

### 替代路径 · Export（不走连接器时）
设计稿右上 **Export** 提供多种导出：**Download .zip / standalone HTML / PDF / PPTX / Send to Claude Code**（另有 Canva/Miro/Vercel 等集成）。当 DesignSync 不可用或想要离线产物时用它兜底。

### 认证
claude.ai 登录会自动升级 `user:design:read/write` scope；hub 侧 MCP 连接器的 design scope 会过期，读稿前如报「needs design-system authorization」则跑一次 `/design-login`（2026-07-07 实测隔天过期）。

---

## 3.5 素材投喂与本地代码链接（2026-07-07 官方文档调研增补）

**素材唯一入口 = `design/inputs/`**（gitignored 素材站，见其 README 索引：CM 官方 logo 包 7 配色 + 现状 5 屏参考图 + 品牌参考）。设计轮开工时从这里挑 2-4 张拖进 claude.ai/design 对话窗；支持图片与 DOCX/PPTX/XLSX 文档。

**本地代码 → 云端 Design System 的三条官方渠道**（本仓现状:渠道①已走完,无需重复）：
1. **DesignSync MCP 手动上传**（本仓采用）：ds-bundle 184 文件已全量在「集结杯 Design System」`108585f1`，Prototype 绑定即自动继承组件与 token——**日常设计轮什么都不用再链**。
2. **Claude Code `/design-sync` 命令**：官方等价路径（拉本地组件库同步 DS），本仓因 import.meta.glob 走了 off-script 变体（见 NOTES）。
3. **GitHub 仓库链接**：在 claude.ai/design 项目里可 link 代码仓库让它理解现有组件/样式。本仓 `github.com/xxpp111/jijiebei` 可链，但注意云端读到的是 **origin 已 push 的版本**——本地领先未 push 时以 DS 底座为准，不建议依赖此渠道。

**官方最佳实践（对本仓有效的几条）**：反馈给精确值（「表单字段间距调到 8px」而非「不太对」）；**按名引用 DS 组件**（ModeButton / DropCell / GoldBadge / BpBadge / RerollBadge / CommanderCard / EnemyBadge / FactorFrame / MapThumb / ObsBar）；可要求一次出 2-3 个布局方案对比再收敛；收尾让它自查可访问性与信息层级。

---

## 4. `.dc.html` 结构速查

设计稿落地的核心文件是 `<Name>.dc.html`，结构固定如下四块：

```html
<x-dc>                                  ← 根容器
  <helmet>                              ← 头：link 进 _ds/design-system-<id>/ 下的
    <link ... tokens / foundations / styles.css>   品牌 token 与基础样式
  </helmet>

  <dc-import name="X" skin="..." mode-name="..." 参数...>
    ↑ 参数化组件实例：name=X 指向同名真身文件 X.dc.html
      skin / mode-name / 其它参数在此传入，驱动皮肤与变体
  </dc-import>

  <script data-dc-script>               ← 交互逻辑
    class DCLogic {
      state = {...}                     ← 组件状态
      renderVals() { return { themeClass, handler, ... } }
                                        ← 返回 themeClass（皮肤类）/ 事件 handler
    }
  </script>
</x-dc>
```

读图要点：
- **`<dc-import name="X">` 是引用，真身在同名 `X.dc.html`**——落地时要把被引用的组件一并 `get_file` 读出来。
- 配套 css（`home-match.css` / `enemy.css` 等）是 **token 驱动**的，颜色/间距走 `var(--xxx)`，不写死。
- `DCLogic.renderVals()` 返回的 `themeClass` 决定三皮肤×明暗的视觉分支，落地交互时对齐这个产出。

---

## 5. 常见坑 + 替代

| 坑 | 现象 | 正解 |
|---|---|---|
| **在 Design System 项目里直接做设计** | 设计停在 canvas，不落项目文件 → hub `get_file` 读不到（用户踩过的坑） | 新建独立 **Prototype** 做设计，绑定 Design System 继承底座 |
| 误以为 `list_projects` 能发现 Prototype | hub 列不出 Prototype，以为没生成 | Prototype 不进 `list_projects`，**必须人工把项目 URL 给 hub** |
| 选成 Product wireframe | 拿到低保真线框，落地信息不足 | 新建时认准 **Product prototype** |
| 连接器临时不可用 | DesignSync 读不到 | 右上 **Export → Download .zip / standalone HTML / Send to Claude Code** 兜底 |

---

## 附录 · 工程要点（落地时照做）

**A. token 复用（零 fallback）**
设计稿 token（`--accent` / `--panel-bg` / `--ink` / `--muted` / `--panel-edge` / `--on-accent` / `--font-num`）与 repo `design/v4-r2` 是**同一套**，直接 `var()` 用，三皮肤×明暗自动适配，无需写 fallback 值。

**B. 溢出量化修法**
设计稿在自己 stage 里 fit，但 repo home 布局（`design/v4-r2`）更松，加新区块易溢出 1280×720 stage（裁底部）。修法：
1. Playwright `evaluate` 量 `.jjb-inner.home` 的 `innerScrollH` vs `720`；
2. 超了就压缩间距；
3. 用**双类 specificity**（`.jjb-inner.home .xxx`）覆盖 `design/v4-r2` 的单类规则——**CSS 走 web 侧覆盖，不改只读源**。

**C. 截图技巧（绕 MCP 硬超时）**
Playwright MCP screenshot 有 5000ms 硬超时，叠加大背景图（1MB+）易超时。改用**独立 playwright 脚本**：
- `page.locator('.jjb').screenshot()` 截 element（1280×720 全 stage），稳过；
- 量化数据用 `evaluate` 取，不靠肉眼估。

**D. 三条红线（零改动）**
- `assets/Script`（Cocos 冻结）
- `design/`（只读设计源，CSS 一律走 web 侧覆盖）
- `assets/resources`（jjdata 冻结）

**E. 保 repo 真相**
设计稿里的占位简化（如灰掉的 06 双打）**不照搬**，落地保留 repo 的真实可用状态。

---

相关：`.claude/skills/jjb-dev-loop/SKILL.md`（迭代主循环，本 SOP 是其「设计轮」环节的展开）；memory `jjb-claude-design-loop`（精炼指针）。

---
name: jjb-dev-loop
description: 集结杯 v4 迭代主循环：Claude Design 设计 → 入库 → spoke 派发 → hub 终验 → 收口提交。推进新设计轮、派发工程 round、做验收、写派发契约时使用。
---

# 集结杯迭代主循环

## 角色与真相源

- **yb（用户）**= 拍板人；**hub（Claude Code 本 session）**= 规划/派发/终验/收口提交；**spoke** = Codex /goal 或 MiniMax M3+Claude Code（经 Dubhe，`claude -n <名> + env ANTHROPIC_BASE_URL=http://127.0.0.1:8686 ANTHROPIC_AUTH_TOKEN=$DUBHE_API_KEY ANTHROPIC_MODEL=minimax-m3`）；**Claude Design（claude.ai 云端项目）**= 设计产出方。
- 真相锚点：`projectplan.md`（每轮决策/验证/遗留全在里面，session 丢失后靠它重建）；设计真相 = `design/v4-r2/`；XP 规则权威 = `assets/Script/jijie2/` 源码。
- XP 对齐基线：live 路径已经 Phase G 审计零差距（8因子=2/3/3 含每场1锁定、手选槽 1/2/2、池=手选槽数恒等式、校验三规则、winCount 含奖励不双计）。有意差异清单见 projectplan「XP 线上老版 vs jjbDesign 行为对比」节，不算 mismatch。

## 一轮迭代的固定走法

1. **设计轮（Claude Design prototype 绑定设计系统）**：在 claude.ai/design 新建项目，模式选 **Product prototype**（高保真交互，不要 wireframe 线框），顶部 **Design system:** 下拉切到「集结杯 Design System」(=`e956fe00`) 绑定 → 这样 prompt 设计时自动继承品牌 token/组件。按 brief 顺序逐块出稿、每块完成停下确认。设计回来 = **prototype 项目 URL**（不是 tar.gz handoff）。详细 SOP 见 `docs/claude-design-loop.md`。
   - 踩坑红线：**不要在 Design System 项目里直接画屏**——那是品牌底座/组件库，设计停在 canvas 不落项目文件，DesignSync 读不到。具体屏幕一律放 Prototype 项目。
2. **入库（hub DesignSync 读 .dc.html → 实现 web/src）**：hub 用 `DesignSync`（claude_design 连接器）拉设计真身，**不再 curl/cp**：
   - `get_project` 确认目标是 Prototype（`type=PROJECT_TYPE_PROJECT`，如「集结杯练习比赛切换」=`19b54387`）；
   - `list_files` 看清单 → `get_file` 读 `<Name>.dc.html` + 配套 css（如 `home-match.css`/`enemy.css`）。
   - 关键事实：`list_projects` 只列 design-system，但 `get_project`/`list_files`/`get_file` 对 **Prototype 项目同样工作**——别再误以为只能读 design-system。
   - `.dc.html` 结构 = `<x-dc>` + `<helmet>`（link `_ds/design-system-<id>/` 下 tokens/foundations/styles.css）+ `<dc-import name=X skin/mode-name/参数>`（参数化组件，真身在同名 `X.dc.html`）+ `<script data-dc-script>`（DCLogic class：state + `renderVals` 返回 themeClass/handler）；配套 css 由 token 驱动。
   - **实现落点 = `web/src`**：prototype 是「具体屏幕」≠ 设计系统组件，**不再 cp 进 `design/v4-r2/`**。token（`--accent`/`--panel-bg`/`--ink`/`--muted`/`--panel-edge`/`--on-accent`/`--font-num`）与 repo `design/v4-r2` 同一套，直接 `var()` 用，三皮肤×明暗自动适配，无需 fallback。
   - **保 repo 真相**：设计稿里的占位简化（如灰掉的 06 双打）不照搬，留 repo 真实可用状态。
   - 设计文件含精确值（u 系数/百分比/动效时长表/token 名），仍是契约 done-when 的锚。
   - _Legacy 备选_：旧 tar.gz handoff（`curl -sL <url> -o handoff.tar.gz && tar xzf` → `diff -rq design/v4-r2/` 找增量 → cp 入库 → 独立 commit）仅在设计方给出 Export → Download .zip / standalone HTML / Send to Claude Code 时启用；prototype 绑定流程下默认不走。
3. **派发**：走 `agent-dispatch` skill 契约（四段+marker）。本仓必带条款：
   - 红线：`assets/Script/jijie2/`、`assets/Scene/`、`assets/resources/jjdata/`、`design/` 零改动；
   - harness round phases=3（init 配方见 `harness-pro-repo-adapter`，每条 CLI 显式 --runtime-dir，review 显式 --model-config）；
   - 不自行 git commit（停在工作树交 hub 收口）；
   - proof 落盘 `/tmp/jjb-v4-impl/playwright-summary-phaseX.json`（含时间戳）+ 全量回归重跑；
   - 截图纪律：等资源全部加载完再拍、拍完逐张目检并在记录里写一行"图里看到了什么"；
   - 几何断言期望值一律从可视区/包围盒实测推导，禁 magic number；坐标红线：JJBView.placed 的 y 已做原点换算且 HALF 动态化，禁裸值覆盖。
4. **hub 终验（不可省）**：见下方清单。spoke 留档 ≠ 真相，hub 必须亲拍。
5. **收口**：hub 终验记录追加进 projectplan（含勘误）→ 一笔 commit（设计偏离若是用户拍板要写明）。

## hub 终验清单（每条都来自一次真实事故）

- [ ] 用 `?cb=<随机>` 防缓存后**亲自实拍**关键屏（事故：用户看到的是缓存旧版；spoke 全页截图无人目检漏掉横条整条出画布）；
- [ ] 全页不裁切看一遍（事故：spoke 按区域裁切截图系统性遮蔽 XP 老场景泄漏）;
- [ ] 抽查断言是否在断"自报常量"（事故：noOverflow:true 字面量、bottomAligned 期望值按坏实现反推）；
- [ ] 非整比例视口（800×400）和明亮主题各看一眼（事故：letterbox 泄漏只在等高视口出现；onState 硬编码只在亮色主题穿帮）；
- [ ] 文字可见性扫一遍：Label 字符串非空 ⇒ 节点宽>0（事故：localLabel 零宽整裁，名牌/角标隐形四轮无人发现）；
- [ ] spoke 声称的"重跑"要有时间戳留痕（事故：summary JSON 是旧轮产物冒充）；
- [ ] **设计稿落 repo 必量化溢出**：Playwright `evaluate` 量 `.jjb-inner.home` 的 `scrollHeight` vs stage 720，>720 即裁底。修法：压缩间距、用**双类 specificity**（`.jjb-inner.home .xxx`）覆盖 `design/v4-r2` 单类、**不改只读源**（事故：设计稿在自己 stage fit，但 repo home 布局更松，新区块直接溢出 1280×720 被裁底）。截图用独立 playwright 脚本 `page.locator('.jjb').screenshot()` 截 element（避 MCP 5000ms 硬超时 + 大背景图超时）。

## 演示态约定

standalone 演示页必须：带红色「演示数据」角标、规则自洽（自称什么模式就经得起按该模式数数）、「双打」语义只在双打模式出现。辨别口诀：右上角有演示角标 = 非真实会话。

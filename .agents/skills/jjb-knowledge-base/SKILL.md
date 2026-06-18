---
name: jjb-knowledge-base
description: 集结杯飞书知识库的维护规范与配方——定位口径/配色/画板/准确性标准、文档与画板 token、lark-cli 编辑配方、开发完成后同步改哪篇。当要新增或修改集结杯知识库文档/画板，或开发完成需回写知识库时使用。
---

# 集结杯知识库维护

## 库在哪 / 谁能改（2026-06-15 迁移后已变，重要）
- **库已整体迁到 `mcn1taa2k785` 租户**（owner=「歪比」`ou_3af26249…`，space_id `7651322868680100812`，总览 node `WF0ZwD2QciFDqGkmHSMcRrdvnyd` / docx `CBvGdEAEko3BFdxhzVgc9ccMnYf`）。**bytedance my_library 原件已被移走、不存在**（旧 space `7480004245586018307` + 下方旧 obj_token 全失效）。
- **当前身份白天朗(`ou_fe7587cdffda88eacf701ed1a67bc7c0`)对新库：编辑已有文档可写、建新节点被拒**。`docs +fetch` 读 + `docs +update`/`docs +media-insert` 改已有文档**实测通**（总览 rev 15+）；但 `wiki +node-create` 建新子页报 `131006 need edit permission`。**→ 新增内容并进已有文档（如「使用指南」已并入总览），不要建新页。**
- **要能编辑**：owner 歪比 给白天朗开 space `7651322868680100812`（或总览节点）的 **edit 权限**（白天朗已能读，升 edit 应可通）；或把 lark-cli 重新授权为歪比账号。
- 拿到写权限后，**旧 obj_token 全废，重新 `docs +search "集结杯"` / `wiki +node-list` 取新 token**。下方 token 表是迁移前的 bytedance 旧值，仅留作历史，勿直接用。

## 文档 token 表（docx obj_token，编辑用）
| 篇 | docx token | 画板 token |
|---|---|---|
| 总览 | `ERMJd17uoo9DeexdZUqcHM4nnvg` | `ZfKNwvG0DhOlTsbvvfhcaGZInlb` |
| 比赛模式与规则 | `FgmFdjs28oz5JExzLvqcv1rKnSb` | `HtDqwyLsOhKzW9bPaG1c22hdnCh` |
| 软件架构与渲染 | `TJOMdVd1aokk5Bx6UqfcrYygnab` | `LKsTwSOnFhq1rWbetd2c87rDnie` |
| 协作与开发流程 | `ODJbdAOPJoJglwxUdmsct9LDn7c` | `S7CywyuINhCXinbHlilcLHvMnsg` |
| 当期赛事配置 | `AVeidFUyYor160x5L3VcA0jtnrg` | （表格无画板）|
| 开放问题与决策 | `BeDjdey9YoksBax41XZcv3R7n3g` | （表格无画板）|
| 架构与协作(样板) | `H1vKdOindoIlYfx9B9NcagJwnAg` | `AeI9wuwmChOE9ObN3TNcT5Tnntg` |

## 五条规范（写 / 改任何篇都守）
1. **定位锚点（全库统一）**：每篇显著处必带——「集结杯 = 《星际2》合作任务『单刷 / 双打挑战赛』；本软件 = 按比赛规则随机生成『突变因子(Mutator)组合』的工具，记分 / 展示只是外壳」。不要退回「抽签 / 记分前端」。
2. **配色（全库画板统一调色板）**：主色 深`#1F2D3D` / 中`#3E5871` / 浅`#DCE4ED`；accent 金棕`#B8893A`（只标题分隔线 + 唯一最高优先元素）；中性底`#F7F8FA` / 描边`#C9D1DA`；文字`#2B2B2B`；警示(唯一)`#C0563B`。四原则：三色封顶 / 层级靠明度不靠色相 / 金色只强调 / 留白优先。
3. **画板 = Codex Visualizer SVG**：走 lark-whiteboard `routes/svg.md`（Codex / GLM 身份 → SVG），在 lark-doc 里用 `<whiteboard>` 嵌；`--check` 0 error；写后 `whiteboard +query --output_as raw` 查 node_count>0。复杂图**隔离 SubAgent**（hub 媒体禁用看不了图，子 agent 能目检自己的渲染 PNG）。
4. **准确性**：真相源 = 仓内 `mode-rules-truth-table.md` + jijie2 源码；**不编**，拿不准的进「开放问题」篇。
5. **公众笔法**：术语首现加白话括注，纯代码符号收进「开发者备注」小节；草稿标「沙盒草稿待校对」。

## lark-cli 配方
- **读**：`lark-cli docs +fetch --api-version v2 --doc <obj> --as user`，正文取 `.data.document.content`。⚠️ **QC 判填充别用 `wc -c` 量整输出**——飞书并发写时读接口偶发串数据/不一致，必须 jq 取 `.data.document.content` 长度 + `whiteboard +query` 查真实 node_count。
- **改**：`lark-cli docs +update --api-version v2 --doc <obj> --command <str_replace|block_replace|block_insert_after|append> ... --as user`；改前 `lark-cli skills read lark-doc references/lark-doc-xml.md`（必要时 `lark-doc-update.md`）；**绝不丢 `<whiteboard token="...">` 块**（丢了画板就没了），改完回读自检画板块还在。
- **画板导图**：`lark-cli whiteboard +query --whiteboard-token <tok> --output_as image --output <cwd内相对目录> --overwrite --as user`（`--output` 只接受 cwd 内相对路径）。
- **改画板**：SubAgent 走 lark-whiteboard，`whiteboard +update --whiteboard-token <tok> --source - --input_format raw --idempotent-token <10+字符> --as user --overwrite`。
- **插图**：`lark-cli docs +media-insert --doc <obj> --file <cwd内相对png> [--selection-with-ellipsis "前缀...后缀"] --as user`（默认追加到末尾；selection 定位插到匹配块**后**，--before 插前）。⚠️ **输出带进度行、非纯 JSON——别管道给 jq（解析失败）、别同条重复跑（会重复插入）**；判成功用 grep `'"ok": true'`。图文交替=按"append 文字→media-insert 图"顺序逐步追加。

## 开发完成后回写哪篇（维护流程）
- **真相先改 `mode-rules-truth-table.md`（单一真相源），再据它回写知识库。**
- 规则 / 抽取逻辑变更（因子数、A/B 抽取、降权、ban）→ 改 **比赛模式与规则** + **当期赛事配置**，并消项 **开放问题**（对应 Q）。
- 架构 / 渲染 / 数据流变更 → 改 **软件架构与渲染**。
- 协作 / 工具链变更 → 改 **协作与开发流程**。
- 改完导新画板 PNG 发 yb 眼检（hub 看不了图）。

## 待办 / 遗留（截至 2026-06-15）
- yb 校对中；mid/low 未做：M9(配置层 vs 代码层)、M11/M12(开放问题合表 + 拆 Q10a-e)、M5(架构术语括注)、补 2 画板(当期配置「配置→随机池影响图」/开放问题「决策状态看板」)。
- **使用指南篇（多实际截图）待建**：起本地服务 + Playwright 截各屏 + `lark-cli docs +media-insert` 插图，落成 KB 新篇。

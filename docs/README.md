---
title: docs · 文档索引（唯一人工导航）
id: jijiebei/docs-index
status: current
owner: jjb-hub
updated: 2026-08-22
applies_to: ["查找任何当前事实文档的入口", "登记新活文档 / 判断文档属 knowledge-flow-archive-generated-compat 哪一栏"]
replaces: []
evidence: ["本目录顶层活文档（各篇头部 front matter 均带 id/title）", "web/scripts/docs-drift-check.mjs（本索引与磁盘的机器校验）"]
review_after: 2026-09-22
---
# docs · 文档索引

> 集结杯活文档唯一人工导航。每份活文档头部带 front matter（`title/id/status/owner/updated/applies_to/replaces/evidence/review_after`）；文档与代码冲突时以代码为准。
> 全仓红线见根目录 `AGENTS.md`，项目入口见根目录 `README.md`，决策史见 `projectplan.md`（append-only，只答「为什么当时这么定」）。

## 当前知识（knowledge · 一主题一 home，改这里别另立副本）

| id | 中文 title | topic | home | 验证入口 |
|---|---|---|---|---|
| jijiebei/architecture | 集结杯 · 架构 | 体系结构 | [architecture.md](architecture.md) | `node web/scripts/docs-drift-check.mjs`（§A 模块清单） |
| jijiebei/deployment | 集结杯 · 部署 | 部署运维 | [deployment.md](deployment.md) | devbox 实测；`backend/deploy/` 配置对照 |
| jijiebei/testing | 集结杯 · 测试体系 | 测试回归 | [testing.md](testing.md) | `node web/scripts/docs-drift-check.mjs`（§D 清单+计数） |
| jijiebei/operations | 集结杯 · 运维手册 | 日常运营 | [operations.md](operations.md) | admin 后台实测 |
| jijiebei/codec-schema | 集结杯 · 对局码 Schema v1 | 对局码契约 | [codec-schema.md](codec-schema.md) | `node web/e2e/codec.mjs`（往返门） |
| jijiebei/rules-config | 集结杯 · 赛事设计与配置导读 | 赛事配置 | [rules-config.md](rules-config.md) | `python3 docs/build_guantu_config.py` 重生成比对 |
| jijiebei/claude-design-loop | 集结杯 Claude Design 闭环 SOP | 设计流程 | [claude-design-loop.md](claude-design-loop.md) | 下一轮设计出稿实操 |
| jijiebei/doubles-guantu-plus-n | 集结杯 · 双打规则一（官突+n）细则 | 赛事规则 | [doubles-guantu-plus-n.md](doubles-guantu-plus-n.md) | draft（待拍板项见文末）；数据基线 = 同目录官突 CSV |
| jijiebei/design-assets | design · Claude Design 设计稿区索引 | 设计稿/资产（跨目录） | [../design/README.md](../design/README.md) | `node web/scripts/docs-drift-check.mjs`（§F 登记对账） |
| jijiebei/diagrams-index | diagrams · 资产索引 | 图表/资产（跨目录） | [../diagrams/README.md](../diagrams/README.md) | `node web/scripts/docs-drift-check.mjs`（§F 登记对账） |
| jijiebei/docs-index | docs · 文档索引（本页） | 文档导航 | [README.md](README.md) | `node web/scripts/docs-drift-check.mjs` |

## 进行中（flow · 未定稿，定稿后迁 knowledge）

| id | 中文 title | topic | home | 状态 |
|---|---|---|---|---|
| jijiebei/scoring-proposal | 集结杯积分系数表方案（待定稿） | 积分系数 | [scoring-proposal.md](scoring-proposal.md) | draft：待 yb/土豆定稿；现 `backend/config/scoring.json` 为占位 |

## 历史归档（archive）

| id | 中文 title | home |
|---|---|---|
| jijiebei/archive-index | docs/archive · 历史归档索引 | [archive/README.md](archive/README.md) |

全部归档分类、文件与边界规则的唯一 home：[archive/README.md](archive/README.md)。

## 规则配置产物（generated · 由 rules-config.md 导读）

| 文件 | 角色 |
|---|---|
| `因子点数配置.csv` | **源**（人工/Agent 编辑） |
| `官突ABC配置_官突池.csv` / `官突ABC配置_挑战池.csv` | **生成**（`build_guantu_config.py` 产出，勿手改） |
| `build_guantu_config.py` | 生成器（读 `assets/resources/data/factors.txt` + 官方点数） |

## 兼容入口（compat · 只有指针，没有事实正文）

| 兼容路径 | 指向 | 缘由 |
|---|---|---|
| `规则一-官突加n-细则v1.md` | [doubles-guantu-plus-n.md](doubles-guantu-plus-n.md) | 2026-08-22 受控 rename（英文稳定路径），历史引用不失效 |
| `research-frontend-p2p3.md` | [archive/research-frontend-p2p3.md](archive/research-frontend-p2p3.md) | 历史调研正文唯一 home 在 archive，旧裸路径留指针防静默失效 |

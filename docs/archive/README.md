---
title: docs/archive · 历史归档索引
id: jijiebei/archive-index
status: current
owner: jjb-hub
updated: 2026-08-22
applies_to: ["考古历史决策/已归档 runbook/旧调研时", "判断某主题是否只有历史版本"]
replaces: []
evidence: ["本目录文件名（含日期，考古按文件名日期读）", "projectplan.md（决策史流水账）"]
review_after: 2026-09-22
---
# docs/archive · 历史归档

> ⚠️ **本目录全部是历史快照，不是 current。** 当前事实入口 = [`docs/README.md`](../README.md)；从本目录找不到当前事实时回导航页，不要把这里的版本当现状。

## 分类

| 类 | 文件 | 说明 |
|---|---|---|
| 立项调研 | `research-frontend-p2p3.md`、`research-backend-p5.md`、`platform-research-report.md` | 立项期调研；结论已沉淀进现行 docs 与代码，原稿留档 |
| 旧 runbook | `runbook-admin.md`、`runbook-backend-p5.md`、`runbook-triple.md` | 已被 `docs/deployment.md`（唯一部署真相源）取代 |
| 知识库快照 | `kb-2026-06/`（7 篇） | 飞书 wiki 是 KB 真身；本快照为 2026-06 考古留档 |
| 派发存根 | `dispatch-*.md`（7 篇） | 已完成派发契约的原文存根，只读 |
| 过期体系图 | `system-maps-2026-06.md` | 现行架构图在 `docs/architecture.md` |
| 设计/规划历史 | `design-briefs-roadmap.md`、`exec-plan-p2p5.md`、`backend-admin-ia.md`、`impl-notes-84-doubles-players.md` | 阶段性设计/执行稿 |
| 早期中文名历史文档 | `项目全貌.md`、`下一阶段-执行蓝图.md`、`集结杯前端-状态与派发.md` | 2026-06 早期项目文档，被现行 docs 取代 |
| 审计/清理留档 | `jjb-test-recovery-audit-2026-06-17.md`、`repo-cleanup-inventory-2026-06-17.md`、`kb-audit-findings.md` | 一次性审计报告 |
| 已退役 skill | `skill-jjb-verify-cocos.md` | Cocos 四套回归不可复跑的留档 |

## 规则

1. **只增不改**：归档正文不追改、不批量补 front matter（历史就是历史）。
2. **不猜 current**：需要判断某主题当前真相时，从 `docs/README.md` 导航找 home；本目录里「看起来最新」的文件不等于 current。
3. **历史缺证不是断链**：`projectplan.md` 历史段引用的部分证据路径（如 `diagrams/phase*`）已不在磁盘，属已声明的历史缺证（见 `diagrams/README.md` 标注），不应伪造成 current 或由治理轮补造。

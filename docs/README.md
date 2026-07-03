# docs · 文档索引

> 集结杯活文档一览。每份文档头部自带「范围 + 真相源」声明；文档与代码冲突时以代码为准。
> 全仓红线见根目录 `AGENTS.md`，项目入口见根目录 `README.md`。

## 活文档

| 文档 | 一句话定位 |
|---|---|
| [architecture.md](architecture.md) | 完整体系图：11 屏前端 + Arco 后台 + PocketBase 7 集合 + devbox 三层同源部署 |
| [deployment.md](deployment.md) | devbox 部署**唯一真相源**（同步、迁移核对、回滚；历史 runbook 已归档） |
| [testing.md](testing.md) | 四层测试体系：代码层 / AI-E2E / 双打同步 / vitest 单测，含全部跑法 |
| [operations.md](operations.md) | 运维手册：账号 / 选手注册 / 赛季 / 系数 / 天梯 / FAQ |
| [codec-schema.md](codec-schema.md) | 对局码 schema v1 契约（URL 分享 + 落库 + 贴码开局三态同源） |
| [scoring-proposal.md](scoring-proposal.md) | 积分系数表方案（待 yb/土豆定稿；现 scoring.json 为占位） |
| [claude-design-loop.md](claude-design-loop.md) | Claude Design 云端出图 → 落地 web/src 的闭环 SOP |
| [rules-config.md](rules-config.md) | 赛事规则与官突配置区说明（同目录中文 CSV / 生成脚本 / 细则的导读） |

## 规则配置产物（由 rules-config.md 导读）

`规则一-官突加n-细则v1.md` · `因子点数配置.csv`（源）· `官突ABC配置_官突池.csv` / `_挑战池.csv`（生成）· `build_guantu_config.py`（生成器）

## archive/

历史快照与已完成派发契约，只增不改：立项调研（research-\*）、旧 runbook（runbook-\*）、知识库快照（kb-2026-06/）、派发存根（dispatch-\*）、过期体系图（system-maps-\*）等。考古时按文件名日期读。

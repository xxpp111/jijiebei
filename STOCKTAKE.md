# 集结杯离职清点（2026-08-30）

## ① Git 层事实

### 主仓状态

- 仓：集结杯 `jijiebei`
- 当前分支：`docs/alioth-governance-v2-20260823`
- HEAD：`84c8afcbc6d3773fb57013ab7fdd2dfb7174197f`
- 上游：`origin/docs/alioth-governance-v2-20260823`
- remote：`https://github.com/xxpp111/jijiebei.git`（fetch/push）
- 盘点时 dirty：**0**
- 当前分支未推 commit：**0**
- local/upstream SHA：一致
- 其他本地分支 `main`、`jjb-platform`、`docs/doc-governance-v1-20260822` 均与各自 origin 对齐。

### 本地-only Git 对象

补充运行 `git log --all --not --remotes` 后发现两个仅由已失效 Harness worktree 元数据保留的本地对象；它们不在活动分支上：

1. `94cbf9e`：旧治理 WIP 快照。其 13 个文件已被当前 `84c8afc` 完整覆盖；当前提交还额外包含 `docs/migration.md`。判断：**丢弃**，本轮未操作。
2. `7b3a289`：上述 WIP 的空 index parent，与当时基线无文件差异。判断：**丢弃**，本轮未操作。

### Dirty 逐项判断

盘点时无 dirty 文件，因此没有需要判为“提交”或“不确定”的项。

附属 LoopX clone 的 tracked status 同样 clean，无独有 commit，push URL 被显式禁用；其唯一价值是 ignored runtime 产物，不应把该临时分支推上游。

### 资产边界

remote 不属于公司内网 Git，但仓内部分部署说明和旧材料仍带公司环境、代理或 devbox 痕迹。因此这是“个人 GitHub 仓 + 公司环境操作痕迹”的混合内容；这些环境相关材料不应未经复核再复制到其他公开仓。

## ② 值得交接的产物

| 有什么 | 给谁 | 怎么交 |
|---|---|---|
| `docs/migration.md`：换电脑、cold backup、隔离恢复、cutover、rollback、decommission 总编排 | JJB 继任者、owner | 现有 GitHub 治理分支；优先审阅并合并到产品线 |
| `docs/deployment.md`、`docs/operations.md`、`docs/backup-restore-manifest.json`、deploy skill | 运维继任者、AI agent | GitHub；分别作为部署、运维、备份机器真相与 AI 路由入口 |
| cold/hot 边界方法论：完整 `pb_data`、canonical 文件集、WAL-aware SQLite、不可变 SHA、单写入者、目标架构门 | 团队、继任者 | 已进入 `docs/migration.md`；这是最重要的方案文档 |
| Alioth 文档治理：稳定 id、中文 title、双账、bootstrap、registrar、8/8 drift gate | 文档维护者、AI agent | GitHub 的 `docs/wiki/README.md`、`docs/README.md` 与治理脚本 |
| 规则配置 CSV、赛事配置、生成脚本 | 产品与赛事维护者 | 已在 GitHub `docs/`，无需另传 |
| 加密 hot safety backup | 新 operator | PRIVATE Release `derivative2002/jijiebei-backups-private@hot-20260824T120026Z`；另行交接私仓权限和密码管理器中的 GPG 口令 |
| r6g Harness rubric、work summary、fixture、verifier、gate/audit | Harness/文档治理维护者 | 当前仅本机：`.harness-pro-alioth-v2-r6g` 约 2.0M、`.harness_local/alioth-v2/r6g` 约 88K；建议私有归档或飞书附件，不直接作为 public source 提交 |
| LoopX 文档行为互校方法：generator、`doc-grooming-check.mjs`、criteria、contract | workflow-os 维护者、JJB 文档继任者 | 当前仅本机 `~/.workflow-os/loopx-jijiebei-docs-0829/`；去除绝对路径和运行态身份后，再进入私有方法仓或飞书 |
| `NIGHT-BRIEF.md` | owner、直接继任者 | 当前仅本机；适合作为安全的飞书交接摘要 |
| `HANDOFF.md` | 无人应把它当 canonical | 2026-08-20 旧快照，含已过期入口和被新决策覆盖的操作建议；只作历史参考 |
| LoopX receipts、ledger、STATE、旧失败 turn | 无人需要长期保留 | 调试证据，可以随机器消失；有效方法已沉淀在 check/criteria 中 |
| `backend/pocketbase-linux-amd64` | 无人需要 | 可重建二进制，已 ignore，不交接 |

### 数据恢复特别说明

- PUBLIC 仓不含数据库、明文备份、GPG 密文或口令。
- PRIVATE Release 已离机保存，拥有私仓权限和正确 GPG 口令时可取回。
- 当前备份分类仍是 **hot safety only**：逐 SQLite 一致，但不是跨库/附件原子快照，不能授权服务器 cutover。
- cold authoritative backup 与真实 staging→live 恢复演练仍未完成。
- GPG 口令只能从 operator 的密码管理器交接；无法从任一 GitHub 仓恢复。

## ③ 知识库现状

### `docs/`

存在并包含：

- 架构、部署、搬迁、运维、测试与规则配置；
- 加密备份 manifest；
- 配置 CSV 与生成脚本；
- `archive/`、`superpowers/`、`wiki/`。

### `docs/wiki/`

存在并包含：

- `log.jsonl`
- `lifecycle.jsonl`
- `bootstrap.json`
- `config.json`
- `_receipts/`
- `schemas/`
- `jijiebei/` 知识投影

机器校验终态：

- `docs/wiki/log.jsonl`：**116 行**
- Alioth：`CHECK_OK`
- log：116
- lifecycle：120
- objects：116
- bootstrap current：81
- coverage：85
- docs drift：**8/8**
- 受治理文档：**17 项**

### Canonical 文档

- `README.md`
- `docs/README.md`
- `docs/architecture.md`
- `docs/deployment.md`
- `docs/migration.md`
- `docs/operations.md`
- `docs/backup-restore-manifest.json`
- `docs/testing.md`
- `.claude/skills/jjb-deploy/SKILL.md`

根目录有 `AGENTS.md`，集中声明代码、数据、部署、凭据与 cloudflared 红线；根目录没有 `CLAUDE.md`。

## 自评

**陌生人只靠当前治理分支的仓内文档，可以理解代码边界、构建系统，并规划安全迁移；但还不能完整接管生产。**

仍缺：

1. 治理分支尚未合并到产品/default 分支；只 clone 默认分支看不到最新搬迁真相。
2. PRIVATE 备份仓权限与 GPG 口令必须单独交接。
3. 当前主机、入口、DNS/TLB/SRE 与生产访问权限不在仓内。
4. cold authoritative backup 与真实恢复演练未完成。
5. 本机 Harness/LoopX 方法论产物尚未进入可离机的私有交接位置。

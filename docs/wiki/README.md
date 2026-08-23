# JJB Alioth v2 · wiki-governance 协议页

> 集结杯（jijiebei）的 Alioth／玉衡治理账本。本目录是**机器账本 + 协议面**，不是人读导航页。
> 参考基线：`workflow-os@d79ae10`（committed 版）——**只取设计，不复制代码**；本实现为零 npm 依赖的轻量 adopter，不 vendor 上游核心。

## 1. 文件面

| 路径 | 角色 |
|---|---|
| `docs/wiki/README.md` | 本协议页（命令、规则、边界声明） |
| `docs/wiki/config.json` | 域配置：type 枚举 / life 枚举 / id 模式 / 路径模板 / 锁与 journal 参数 |
| `docs/wiki/log.jsonl` | artifact 身份 / 导航账（每行一个注册记录，字段见 §3） |
| `docs/wiki/lifecycle.jsonl` | 唯一状态事件权威（每行一个事件，append-only，字段见 §4） |
| `docs/wiki/bootstrap.json` | 当前 80 项 Markdown disposition 明细；账内保留 82 条历史 boot 快照（初始 78 条 + 4 次 canonical 内容刷新），另有 2 项与 register 行同 id 以 REPLAYED 跳过；coverage 由本文件显式界定 |
| `docs/wiki/schemas/artifact-record.schema.json` | log 行 JSON Schema（draft-07） |
| `docs/wiki/schemas/lifecycle-receipt.schema.json` | lifecycle 行 JSON Schema（draft-07） |
| `docs/wiki/jijiebei/<slug>/r<ts>.<type>.<ext>` | artifact 本体（plan/decision 强制 html + lm 标记） |
| `docs/wiki/.registrar.lock` | 写事务锁（O_EXCL；stale 不抢占，fail-closed `STALE_LOCK` 走人工恢复，见 §5） |
| `docs/wiki/.registrar.journal.json` | write-ahead journal（中断恢复的唯一依据） |
| `docs/wiki/*.jsonl.new` | staged 账本（rename 前的中间态） |
| `docs/.context-manifest.json` | `build-context` 产物（gitignore，不进仓） |

## 2. 命令（退出码 0=ok / 1=fail / 2=fatal）

```bash
node web/scripts/wiki-governance.mjs bootstrap  --manifest <bootstrap.json> [--repo-root <d>] [--json]
node web/scripts/wiki-governance.mjs register   --manifest <artifact-manifest.json> [--repo-root <d>] [--json]
node web/scripts/wiki-governance.mjs transition --manifest <transition-manifest.json> [--repo-root <d>] [--json]
node web/scripts/wiki-governance.mjs check      [--json]                    # 双账一致 + 投影重建 + bootstrap 对账
node web/scripts/wiki-governance.mjs query      <id|path|slug> [--json]
node web/scripts/wiki-governance.mjs build-context [--out <path>] [--json]
```

- `--json`：stdout 输出**唯一**一行 JSON `{status, code, recovered, counts, errors, message, ...}`；失败路径同样走 JSON。
- `--repo-root <d>`：测试隔离锚点（fixture 镜像 repo 结构，绝不碰真实账）；生产使用缺省（自锚定 repo 根）。
- 写命令（register/bootstrap/transition）串行执行：`docs/wiki/log.jsonl` 与 `docs/wiki/lifecycle.jsonl` 是**唯一落账写手**（sub-hub）经本 CLI 写入，任何人不直接改账。

## 3. log.jsonl 行（stable 序列化：递归按键排序，逐字节可复现）

```json
{"registration_id":"…","id":"jijiebei/<slug>@r<YYYYMMDD-HHMMSS>","path":"…","title":"…","type":"plan|decision|report|digest","life":"flow|archive|knowledge","topic":"…","owner":"…","close_policy":"…","canonical_targets":[…],"source_refs":[…],"source_sha256":"<64hex>","ts":"RFC3339"}
```

- `id` 唯一标识一个 artifact 版本；`registration_id` `reg-*`（register）/ `boot-*`（bootstrap 导入）。
- **life 由 mode 推导，不能与 mode 矛盾**；不带 mode 的 legacy 调用才沿用 plan/decision→`flow`、report/digest→`knowledge` 的兼容默认值。六种 authoring mode：

| mode | type | life |
|---|---|---|
| `plan-active` | `plan` | `flow` |
| `decision-open` | `decision` | `flow` |
| `report-validating` | `report` | `flow` |
| `digest-active` | `digest` | `flow` |
| `knowledge-current` | `report` | `knowledge` |
| `archive-import` | manifest 显式给出 | `archive` |
- `path` 规则：register 行必须匹配 `docs/wiki/jijiebei/<slug>/r<ts>.<type>.<ext>`（slug/ts/type/ext 与 id 一致；plan/decision 强制 `.html`）；bootstrap 行为既有文档原路径（如 `docs/operations.md`）。
- **source_sha256 语义**：注册时对 path 文件实算（manifest 显式提供则先校验，漂移即 `SOURCE_SHA_DRIFT`）。boot 行是**锁定快照**——check 对 boot 行重算对账；register 行为登记时快照，check 不核（文件后续修改属正常演进，需冻结时重注册新 rev 即可）。
- **幂等判定（REPLAYED）**：同 `id` 重复注册，比较**除 `registration_id`/`ts` 外的全部字段**（last-moment 指标与执行时间必然不同，不能参与幂等）；全一致 → `REPLAYED`（不追加行），任一实质字段不同 → `REGISTRATION_CONFLICT`。

## 4. lifecycle.jsonl 行（事件模型）

```json
{"event_id":"lce-<hash20>-<seq>","object":"jijiebei/<slug>@r…","from":{"state":"…","life":"…"},"to":{"state":"…","life":"…"},"event":"register-flow|register-knowledge|register-archive|bootstrap-import|correct-life|promote|archive|supersede","actor":"…","authority":"…","evidence":[…],"actions":[…],"occurred_at":"RFC3339"}
```

- append-only；`seq` 全局递增（check 校验唯一）。
- 事件合法转换表（fail closed，未列出即 `INVALID_TRANSITION`）：

| 事件 | from | to |
|---|---|---|
| `bootstrap-import` | `null` | `{imported, <life>}`（life 由 bootstrap item 显式给出，不伪造 register 语义） |
| `register-flow` | `null` | `{registered, flow}` |
| `register-knowledge` | `null` | `{registered, knowledge}` |
| `register-archive` | `null` | `{registered, archive}`（`archive-import`） |
| `correct-life` | `{registered,knowledge}` → `{registered,flow}` ｜ `{imported,knowledge}` → `{imported,flow}` | 仅订正误记 life，state 不变 |
| `promote` | `{registered,flow}` → `{registered,knowledge}` ｜ `{imported,flow}` → `{imported,knowledge}` ｜ `{archived,archive}` → `{registered,flow}` | 沉淀 / 激活 |
| `archive` | 任何未归档 | `{archived, archive}` |
| `supersede` | 任何 | `{superseded, archive}` |

- **状态不回退**：只有表中显式列出的 `correct-life` 可做 registered/imported `knowledge→flow` 订正；其余未列组合一律 `INVALID_TRANSITION`，check fail closed。
- **log.life 纪律**：`log.life` 永远等于 lifecycle 折叠结果，任何人不直接手改。register/bootstrap 写初始 life 并同时产生初始事件；transition 在同一 lock+journal 事务中追加事件并同步重算对应 log 行。check 只验证、不修复。
- **三种状态面不可混写**：lifecycle `state` 表示八态事件机中的对象状态，`life` 只取 `flow|archive|knowledge` 并由事件折叠；registrar 命令返回的 `status/code` 只是本次事务结果，不是前两者，也不代表 Harness gate、audit 或 owner approval。

## 5. 并发与恢复（诚实边界声明）

- 写事务 = **lock → journal(意图) → staged×2 → 顺序 rename（先 lifecycle 后 log）→ 清 journal**。
- **不宣称「两文件 OS 级单次原子写」**：两次 rename 之间存在窗口，可能只落一账；write-ahead journal 保证下次写操作（register/bootstrap/transition）先恢复再继续，任一时刻账本要么旧态、要么新态、要么可由恢复流程收敛。
- 恢复判定以「当前实账哈希是否等于期望终态」为准，不猜中断点；staged 完整且哈希匹配 → 续 rename（`recovered: resumed`）；损坏/缺失 → 回滚 staged（已是半态的一账按行级回滚到 base）并报 `recovered: aborted`（`RECOVERED_ABORTED`），然后**继续本次写操作**。
- 只读命令（check/query/build-context）发现 journal 残留 → `NEEDS_RECOVERY` 拒绝执行（fail closed，先跑一次写命令触发恢复）。
- 锁不做 stale 抢占：持锁者失联 / 锁文件超过 stale 阈值时，后来者**不得**覆盖既有锁文件，直接 fail-closed 报 `STALE_LOCK`，由人工确认无在途写事务后清理（token 校验的主动 release 仍有效）。抢占式覆盖会让两个竞争者同时判断 stale 并都持锁成功（gen2 Codex major），故 gen3 起永久关闭该路径。

## 6. 错误码

`OK` / `REPLAYED`（幂等成功，exit 0）｜ `LOCKED` / `STALE_LOCK` / `NEEDS_RECOVERY` / `RECOVERED_ABORTED` / `BASE_STATE_CHANGED` / `INVALID_TRANSITION` ｜
`REGISTRATION_CONFLICT` / `PATH_ESCAPE` / `PATH_MISMATCH` / `FILE_NOT_FOUND` / `LM_MARKER_MISSING` / `SOURCE_SHA_DRIFT` /
`MISSING_DISPOSITION` / `INVALID_INPUT` / `MANIFEST_NOT_FOUND` / `NOT_FOUND` / `CHECK_FAILED` / `CORRUPT_LEDGER` / `FATAL_CONFIG`

## 7. bootstrap.json 契约（Phase 3 sub-hub 填写，本 CLI 只实现机制）

```json
{
  "generated_at": "RFC3339",
  "coverage": ["docs/**/*.md", "design/README.md"],
  "items": [
    { "path": "docs/operations.md", "id": "jijiebei/operations@r<ts>", "type": "report",
      "life": "flow", "disposition": "current", "reason": "…", "title": "（可选，缺省 front matter）" }
  ]
}
```

- `coverage` glob 界定「`git ls-files` 枚举的 tracked Markdown + bootstrap 显式 item」范围（支持 `**`/`*`/`?`）；Git 枚举是 coverage 的唯一 Git 依赖，命令失败必须报 `FATAL_CONFIG` 并 fail closed，绝不把 tracked 基线退化为空。disposition 可由 bootstrap item 或任一 log/register path 提供。范围内文件两者均未登记 → `MISSING_DISPOSITION`；登记了不存在 → 红；`life` 显式给出（既有文档不伪装 register 语义）；`id` 由 sub-hub 决定（slug + rev 快照时间）。未 tracked 且未作为 bootstrap item 声明的本地文件不进入提交态 coverage。
- bootstrap 是**一整份一次事务**导入；部分幂等：某 id 已落账且一致 → 跳过（计数 replayed），不一致 → 整体 `REGISTRATION_CONFLICT`。
- generation4 correction 终态口径：current bootstrap dispositions 固定为 80；账内 boot 历史为 82（初始 78 + 4 个 canonical refresh）。当前工作区未暂存，因此 coverage 文件数为 80；Hub 后续把原有 3 个和本轮 1 个 registered Markdown 纳入提交态后，预期 coverage 为 84。两者是不同 Git 状态下的读数，不互相替代。

## 8. artifact registry（log 投影 · 供 §H 门对账）

> 维护职责：register/bootstrap **不自动**更新本表——每次落账后由落账执行者（sub-hub）同步本表；`docs-drift-check.mjs` §H 对本表做**逐列对账**（id/title/type/life/path 五列与 log.jsonl 最新行一致，gen3 起从仅比对 id 扩为五列全比对）。
> 范围：本表只收 register 行（`reg-*`）；bootstrap 导入行（`boot-*`）由 `bootstrap.json` 管理，不进表。
> 下表是 **generation4 correction 已落账终态**：历史 4 次 transition、gen3 的 3 次 register 与本轮 1 次 register 均由 contract-only 执行位经 registrar CLI 串行完成；共 11 条 register 行，表中五列与 log 当前投影对齐。

| id | title | type | life | path |
|---|---|---|---|---|
| jijiebei/alioth-governance@r20260823-145244 | 集结杯 Alioth 治理浪涌 v2 · 执行计划 | plan | flow | docs/wiki/jijiebei/alioth-governance/r20260823-145244.plan.html |
| jijiebei/potato-ai-bias@r20260823-094100 | 土豆 AI 加权彩蛋 · Implementation Plan（原稿归档） | plan | archive | docs/wiki/jijiebei/potato-ai-bias/r20260823-094100.plan.html |
| jijiebei/potato-ai-bias@r20260823-094101 | 土豆主播「旧世机械团」随机彩蛋 · 设计决策（原稿归档） | decision | archive | docs/wiki/jijiebei/potato-ai-bias/r20260823-094101.decision.html |
| jijiebei/open-decisions@r20260823-094500 | 集结杯 · 开放决策集（待 owner 拍板） | decision | flow | docs/wiki/jijiebei/open-decisions/r20260823-094500.decision.html |
| jijiebei/engineering-backlog@r20260823-094500 | 集结杯 · 工程待办集（backlog） | digest | flow | docs/wiki/jijiebei/engineering-backlog/r20260823-094500.digest.md |
| jijiebei/recent-progress@r20260823-094500 | 集结杯 · 近期进展（2026-08 治理浪涌 v2 时点） | digest | flow | docs/wiki/jijiebei/recent-progress/r20260823-094500.digest.md |
| jijiebei/factor-pick@r20260823-094500 | 集结杯 · 豆包因子点播 plan（waiting-owner） | plan | flow | docs/wiki/jijiebei/factor-pick/r20260823-094500.plan.html |
| jijiebei/recent-progress@r20260823-111300 | 集结杯 · 近期进展（2026-08-23 post-GC 时点） | digest | flow | docs/wiki/jijiebei/recent-progress/r20260823-111300.digest.md |
| jijiebei/recent-progress@r20260823-153500 | 集结杯 · 近期进展（generation4 correction 时点） | digest | flow | docs/wiki/jijiebei/recent-progress/r20260823-153500.digest.md |
| jijiebei/potato-ai-bias@r20260823-111400 | 土豆 AI 加权彩蛋 · post-GC correction 报告 | report | knowledge | docs/wiki/jijiebei/potato-ai-bias/r20260823-111400.report.md |
| jijiebei/alioth-gc@r20260823-111500 | 集结杯 Alioth v2 · GC 结算报告（manifest v3） | report | flow | docs/wiki/jijiebei/alioth-gc/r20260823-111500.report.md |

已由 sub-hub 串行落账的变更（可执行 manifest 在 `.harness_local/alioth-v2/phase2-manifests/`，上游草稿保留在 `.harness_local/alioth-v2/spoke-b3/`）：

1. correct-life：`engineering-backlog@r20260823-094500`、`recent-progress@r20260823-094500` knowledge→flow（digest-active 模式，gen2 误 register-knowledge）。
2. archive：`potato-ai-bias@r20260823-094100`（plan）、`@r20260823-094101`（decision）flow→archive（archive-import，原稿归档语义）。
3. register：`recent-progress@r20260823-111300`（digest-active→flow）、`potato-ai-bias@r20260823-111400`（knowledge-current→knowledge，canonical_targets=["docs/potato-ai-bias.md"]）、`alioth-gc@r20260823-111500`（report-validating→`{registered,flow}`）。
4. generation4 correction register：`recent-progress@r20260823-153500`（digest-active→flow），只新增 revision，不追改 `r20260823-111300`。
5. `alioth-gc` report 的 life=`flow` 来自 mode 矩阵 `report-validating`={type:report, life:flow}；实际 lifecycle 初态为 `{registered,flow}`。

## 9. 测试

```bash
node --test web/scripts/wiki-governance.test.mjs    # 22 例（gen3 A3：13→22，新增双进程并发/stale-holder/old-holder resume/base-drift/mode/transition/投影/NUL 断言），覆盖 spec §6 十类红绿
```

类型：正常注册 / 幂等 REPLAYED / 冲突 / 路径逃逸（含 symlink）/ SHA 漂移 / 非法 transition（含"promote 必须同步 log.life"纪律）/ 中断恢复 resumed+aborted+NEEDS_RECOVERY / bootstrap 双向对账 / lm 标记 / 零态重建。全部走 `--repo-root` 隔离 fixture，不触碰真实账。

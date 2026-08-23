---
title: 集结杯 · 土豆 AI 加权彩蛋
id: jijiebei/potato-ai-bias
status: current
owner: jjb-hub
updated: 2026-08-23
applies_to: ["查「土豆 AI 彩蛋 / 土豆的老朋友」现在怎么工作", "改随机敌方或彩蛋逻辑前读", "排障 Select/Battle/OBS 三屏彩蛋标签"]
replaces: []
evidence: ["web/src/logic/aiEnemySelector.ts（75% 直达 + 完整池 fallback）", "web/src/logic/jjbView.ts（三屏标签透传）", "backend/pb_migrations/1782000010_accounts_potato_ai_bias.go（字段与权限）", "web/e2e/potato-ai-bias.mjs + sec-potato-ai-bias.mjs + flows/potato-ai-bias.flow.mjs", "docs/wiki/jijiebei/potato-ai-bias/r20260823-094100.plan.html + r20260823-094101.decision.html（原稿 verbatim 归档，源路径已 GC 移除）"]
review_after: 2027-01-01
---
# 集结杯 · 土豆 AI 加权彩蛋

> 与「土豆」相关的局，随机敌方加权抽中人族 AI「旧世机械团」，抽中时展示「土豆的老朋友」。这是 owner 明确批准的主播彩蛋，**不是**安全或竞技防伪机制；正式计分赛的敌方分布被改变是已知并批准的产品行为。

## 1. 是什么

- 触发态下，每场随机敌方以约 **76.32%** 概率抽中「旧世机械团」（`T_MechClassic`），三场允许全部相同。
- 抽中时在 Select / Battle / OBS 三屏展示短文案「土豆的老朋友」。
- 设计批准稿：`docs/wiki/jijiebei/potato-ai-bias/r20260823-094101.decision.html`（2026-07-17 owner 批准的设计稿，已 verbatim 归档为 wiki revision；源路径 `docs/superpowers/specs/2026-07-17-potato-ai-bias-design.md` 已由批准 GC 移除）。

## 2. 触发

任一条件满足即触发（`web/src/logic/aiEnemySelector.ts` `shouldUsePotatoBias`）：

1. 当前登录账号的管理员布尔标记 `accounts.potato_ai_bias === true`；
2. 单打 `SelectState.playerName`，或双打 `_players[0]` / `_players[1]` 任一名称 `includes('土豆')`。

- 名字匹配是子串匹配：「儒雅随和の土豆」「土豆队」「小土豆」均触发；空值与不含「土豆」不触发。
- 名字旁路是 owner 批准的公开玩法入口，任何选手都能主动触发；**浏览器端不防伪**。
- 触发快照只用于本次抽取：登出、切账号、改名不改写已生成的三场结果，下一次开局重新计算。

## 3. 概率

每场独立、有放回（`web/src/logic/aiEnemySelector.ts`，`POTATO_DIRECT_RATE = 0.75`）：

1. 先做一次 75% 判定，命中直接选 `T_MechClassic`；
2. 未命中的 25% 从完整 19 项 AI 池均匀抽（池仍含旧世机械团）。

- 单场旧世机械团：`0.75 + 0.25 × 1/19 = 29/38 ≈ 76.32%`；
- 三场全部旧世机械团：`(29/38)³ ≈ 44.45%`；
- 允许任意重复，无去重逻辑；
- 未来 AI 池大小变化时第二项随之变化，75% 直达权重不变。

## 4. 生效面

- 所有复用 `rollEnemiesForSession()` 的单打 / 双打模式，`practice` 与 `match` 均生效。
- 随机敌方开关关闭：不生成敌方，也不显示彩蛋。
- 随机源与触发快照为可选依赖注入（`rollEnemiesForSession(matchCount, rng, potatoBiasActive)`），生产默认 `Math.random`、默认不触发；`aiEnemySelector` 不自行读认证状态或选手名。

## 5. 展示

- `web/src/logic/jjbView.ts` `currentEnemyEasterEggLabel`：`potatoFriend ? '土豆的老朋友' : undefined`。
- Select / Battle / OBS 三屏透传，走 `EnemyBadge` 通用 `easterEggLabel` 属性，不在通用 Badge 内硬编码身份判断。
- 无论来自 75% 直达还是 25% 普通池自然命中，展示完全一致（不泄露随机分支来源）。
- 非触发态、普通旧世机械团结果、随机开关关闭时均不显示。

## 6. 数据与权限

- 字段：`accounts.potato_ai_bias`（Boolean，默认 `false`），amendment migration `backend/pb_migrations/1782000010_accounts_potato_ai_bias.go`，**不修改既有 migration**。
- 权限：账号更新规则同时锁 `role` 与 `potato_ai_bias`——普通账号不能 API 自开标记，admin 可置 / 撤；普通非敏感字段更新不回归。
- 认证链：`web/src/logic/backend.ts` `AuthAccount.potato_ai_bias` + `readPotatoBias`（登录 / refresh 解析，缺失或非布尔按 `false`）。
- 维护入口：PocketBase Admin UI，无前台设置入口。
- 不把触发标记或命中来源写入 codec v1、match payload 或后端记录。

## 7. 测试锚点与边界

**测试（全部在库）**：

| 测试 | 覆盖 |
|---|---|
| `web/e2e/potato-ai-bias.mjs` | SSR 确定性随机：75% 直达、25% 完整池 fallback 自然命中、非触发 RNG 次数、账号 / 单双打名字触发、开关 OFF |
| `web/e2e/sec-potato-ai-bias.mjs` | 隔离 PB：新 host 默认 false、host 不能自开、普通字段与同值回写可更新、admin 可设置、Round S role 不回归 |
| `web/e2e/flows/potato-ai-bias.flow.mjs` | 浏览器连续流：Select / Battle / OBS 三处显示，OBS 1280×232 几何不溢出 |
| `web/src/logic/__tests__/backend.test.ts` | 认证响应字段解析 |

**明确不做（沿设计稿边界）**：

- 不动 codec schema v1；不处理贴码 / 恢复会话的敌方还原缺口；
- 不新增服务端抽签 API；不把命中原因持久化到 matches / logs；
- 不处理 BP 设置页反复开关可重新抽取敌方的既有行为；
- 不追求浏览器端防伪；不改其他 AI 的概率或池配置。

## 历史原稿

以下两篇原稿已 verbatim 归档为同一 slug `potato-ai-bias` 的 wiki revisions（plan + decision 各一），本页是 canonical 知识页；源路径已由批准 GC（manifest `gc-alioth-v2-20260823-065156-v3` attempt2，reply-5 批准）移除：

- `docs/wiki/jijiebei/potato-ai-bias/r20260823-094100.plan.html`（实施计划，661 行，源 SHA `0c06eeb1…`）
- `docs/wiki/jijiebei/potato-ai-bias/r20260823-094101.decision.html`（设计稿，198 行，源 SHA `36bc1935…`）

post-GC correction 事实（含本页更新记录）见报告型 revision `docs/wiki/jijiebei/potato-ai-bias/r20260823-111400.report.md`。

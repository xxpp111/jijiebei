# #84 双打积分归属占位 bug — implementation notes

## Root cause
`jjbView.ts:59` `currentPlayerName()` doublesLive 分支返回字面量 `'双打战队'`。
落库链路 `matchRecord.ts:44` `ensurePlayer(currentPlayerName())` → `players:[单个占位 id]`。
双打天梯 100% 归占位实体「双打战队」，两名真选手拿不到分。

## Single-player chain (MUST stay byte-identical)
HomeScreen.playerName(state) → start() 覆盖 JijieData.playerName
→ getSelectState().playerName → currentPlayerName()
→ matchRecord ensurePlayer(name) → players:[id]（单元素）

## Backend (ZERO change — verified)
hooks.go scoreMatch:148 `playerIDs := match.GetStringSlice("players")`；:157-172 循环为每个 pid 写一条 scores。
传两名 players → 后端自然为两人各记一条 scores。本轮纯前端。

## Fix design (surgical, doubles players 来源链路 only)

### 存储位置 = jjbDoubles 闭包（理由）
- doublesLive() 已是双打全链路的 gate；双打局的所有运行期状态（variant/池/槽/winLoseList）都住 jjbDoubles 闭包。
- 两名选手是"双打局状态"的一部分，放同一闭包与邻近风格一致（setDoublesCmd/getDoublesState 范式）。
- doublesStart/doublesReset 重置为默认名 → 深链接/贴码开局（不经 HomeScreen）也有合理默认两名。
- 单打不受影响（单打读 JijieData.playerName，与此闭包无关）。

### 改点
1. jjbDoubles.ts：
   - `_players: [string,string]` 模块态 + DEFAULT_PLAYERS=['选手A','选手B']
   - `setDoublesPlayers(a,b)` / `getDoublesPlayers(): string[]`（trim + 空回落默认）
   - doublesStart/doublesReset 重置 _players=默认
   - DoublesState + debugSnapshot 加 `players`（additive，__jjbDebug 只增字段不改名，安全）
2. jjbView.ts：
   - `currentPlayers(): string[]` 新增：单打 `[currentPlayerName()]`、双打 `getDoublesPlayers()`
   - `currentPlayerName()` doublesLive 分支：`'双打战队'` → `getDoublesPlayers().join(' & ')`（display 用；落库改走 currentPlayers）
3. HomeScreen.tsx：
   - 加 playerNameB state + 第二输入框（data-player-input-b），始终渲染（mode 点击时才知单/双，最简功能）
   - start()：startSession 后若 doublesLive() → setDoublesPlayers(nameA, nameB)（镜像单打 set JijieData.playerName）
4. matchRecord.ts：
   - `ensurePlayer(currentPlayerName())`→单元素 改为 `currentPlayers().map(ensurePlayer)`→[idA,idB]
   - 只改 players 来源；result/score_total/触发时机/指纹/autoPost 一字不动
5. SelectScreen.tsx:572：`v="双打战队"` → `v={getDoublesPlayers().join(' & ')}`（清占位，rg 双打战队 → NO_PLACEHOLDER_LEFT）

## Caveats (待 hub/yb 知晓)
- 深链接/贴码开局（不经 HomeScreen）双打两名 = 默认 '选手A'/'选手B'（codec schema v1 冻结，不能把两名编进对局码 — 红线⑦）。
- 双打 practice 模式 + 选手账号：ensurePlayer 对 player-kind 走 relation，两名都 → 同一 relation id。前端提交 [id,id]，
  但 PocketBase 多关系字段 normalizeValue/DriverValue 走 ToUniqueStringSlice 去重（v0.39.4 core/field_relation.go:169-184，
  hub review 亲验坐实），实际落库 = [id]，且 practice 不派生 scores——双重无害。#84 靶心是 match 模式 host 双打
  （host 走昵称兜底 → 两名各建/取 → 两 distinct id）。不 dedup 以保持契约 "各 ensurePlayer"。
- 同名双打（host 在 A/B 输入相同名）：两次 ensurePlayer 同一 id → PB 去重落成 players=[id] → scoreMatch 只写一条 scores。
  不会双倍计分（review lens 曾疑，hub 按 PB 源码裁决否），真实后果 = 该局静默记成单归属（数据质量退化，非计分错误）。
  前端未拦同名输入，接受为已知边界（B 空回落默认名故通常 distinct）。
- review defer 项（合并后遗留，非阻断）：① LadderScreen 自高亮双打下失效（me='A & B' 不匹配单名行；旧占位反而能命中占位行。
  装饰性，双打本就无单一"我"）；② HomeScreen 选手 B 行常驻渲染加重 home-match 已知竖向溢出——#75 首页重设计须纳入高度回归；
  ③ deep-link 默认名分支（选手A/B 兜底）的落库断言、practice player-kind 双打行为钉测——留下一轮测试补强。

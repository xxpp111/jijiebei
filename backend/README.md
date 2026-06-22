# 集结杯 P5 后端（PocketBase）

> 集结杯比赛平台后端地基（P5）：5 集合 schema + 记录级权限 + 积分/天梯 Go hook + Litestream 容灾。
> 前端 `web/src` 仅只读对接（本 round 不改前端代码），汇流 = 前端 `fetch /api`（后续独立 phase）。
> 真相基线：`docs/research-backend-p5.md`（schema 字段级 + 权限矩阵 + hook 伪码 + 部署）+ `tmp/platform-research-report.md` §1/§2/§5。

## 起跑（mac 本地验证）

```bash
cd backend
go mod tidy                  # 拉依赖（首次；需外网）
go build -o pocketbase .     # 编译（含 pb_migrations，单二进制）
rm -rf pb_data && ./pocketbase migrate up   # migrations 从零重放建 5 集合
./pocketbase serve --http 127.0.0.1:8090 &  # 起跑；Admin UI: http://127.0.0.1:8090/_/
```

## 端点

| 端点 | 用途 |
|---|---|
| `GET /_/` | Admin UI（管理员后台） |
| `POST /api/collections/accounts/auth-with-password` | 主播登录（email+password） |
| `GET/POST /api/collections/{players\|matches\|scores\|logs}/records` | CRUD（受 API Rules 约束） |
| `GET /api/rankings?season=<可选>` | 天梯聚合（SUM(delta) GROUP BY player，公开） |
| `GET /api/scoring` | 当前系数表 + 赛季 + 公式（公开，天梯页展示用） |

## 5 集合 schema（概览）

| 集合 | 类型 | 关键字段 | 读 | 写 |
|---|---|---|---|---|
| `players` | base | nickname, player_code(unique), race_pref, avatar, active | 公开 | host\|admin |
| `matches` | base | mode, game_mode, payload_code, players, host, result, score_total, bp_config | 公开 | host\|admin（改：本人主持\|admin） |
| `scores` | base | player, match, delta, reason, season | 公开 | admin-only（hook 写） |
| `logs` | base | actor, action, target_type, target_id, detail, ip | admin-only | hook 写；不可改不可删 |
| `accounts` | auth | role(admin/host/viewer), display_name + 内置 email/password | admin-only | admin-only（update 可改自己） |

完整字段 + 权限矩阵见 `pb_migrations/1782000001_init_collections.go` + `docs/research-backend-p5.md` §1.6。

## schema ↔ live 同形映射表（契约 done-when 核心证据）

证明 schema 与 live 选择状态同形 —— 届时前端「读本地 TS 常量」换「fetch /api」消费方签名不变。

### matches POST payload ↔ live（web/src/logic）

| `matches` 字段 | live 源（文件:行） | 说明 |
|---|---|---|
| `mode` | `HomeScreen.setRuleMode('practice'\|'match')` (HomeScreen.tsx:38, jjbSession.ts:821) | 入口分流落库点 |
| `game_mode` | `SessionMode` 11 枚举字符串 (jjbSession.ts:64) | **直存原值**，零翻译：std8/std10/std12/rescue/one-a/hard1/hard2/feiqiu/suiji/doubles/feiqiu-doubles |
| `payload_code` | `encodePayload(getSelectState() \| getDoublesState())` | 整局索引码（与 P3 码方案同一编码器，单字段可还原一局，max 512） |
| `payload_ver` | 码 schema 版本号 | 池重排校验（开放问题 #2） |
| `players` | `players` 记录 id（经 `player_code` 关联） | 双打 2 人（jjbDoubles `_slots`），多关系 |
| `host` | `accounts.auth.id` | 主持主播（practice 可空） |
| `result` | `winLoseList` (jjbSession.ts:935, `RESULT_VAL` lose0/win1/bonus2) | **直存** number 数组 |
| `score_total` | `getScore()` (jjbSession.ts:458, win+bonus 计获胜场不双计) | 前端传，hook 从 `result` 复算不依赖（防伪造） |
| `bp_config` | `bpConfig` 快照（ruleMode + 违规判定 `getBpExclusive`） | 防 BP 规则演进失真 |
| `started_at`/`ended_at` | 对局起止 | optional |

### scores（hook 派生，前端不直接写）

| `scores` 字段 | 来源 | 说明 |
|---|---|---|
| `player` | `match.players` 关系项 | 选手实体 |
| `match` | `match.id` | 来源对局 |
| `delta` | hook 算：`wins × coef` | 本局天梯分增量 |
| `reason` | hook 生成：`wins=N × coef=X.XX (game_mode) season=S` | 计分依据（可追溯） |
| `season` | `config/scoring.json` `current_season` | 天梯分赛季聚合键 |

### 双打路径（payload_code 双路径）

单打编码 `{mode, mapList, lockFactorList, selectedCommanderList, selectedFactorList, modeFlags, enemyRace/Ai}` ← `getSelectState()` (jjbSession.ts:535)
双打编码 `{variant, matchMaps, matchMutators, _slots(cmds+factors), commanderPool}` ← `getDoublesState()` (jjbDoubles.ts:206)
编码器实现属前端/P3（caveat 2），本 round 只定 `payload_code` 字段 + 长度上限。

## 积分算法

```
delta = 获胜场 × coefficients[game_mode]
获胜场 = result 中 v==1(win) 或 v==2(bonus) 计数（对齐 jjbSession.getScore()，win+bonus 不双计）
系数表 = config/scoring.json（配置化，不硬编码进 hook；改系数改 JSON 重启即生效，不重编译 Go）
mode=practice → hook 跳过算分（不进天梯，开放问题拍板）
天梯 = scores 按 season 聚合 SUM(delta) GROUP BY player（不单独建表，/api/rankings 实时聚合）
```

系数初值（最简，caveat 3 待 yb/土豆定稿）：std8=1.0 / std10=1.1 / std12=1.2 / rescue·hard=1.3 / doubles·feiqiu=1.0。

## 部署

见 `deploy/runbook.md`（本地起跑验证 + devbox 裸进程部署 + Litestream 容灾 + caveat）。

---

## P5 后端验证记录（2026-06-22 round2：修复 + 全 proof 通过）

### 本轮修复（3 处，相对上一轮初稿）

1. **`pb_migrations/1782000002_lock_default_users.go`（新增）**：PocketBase v0.39.4 自带默认 `users` auth 集合 createRule=`""`（开放自助注册）。无 `role` 字段故无法越权写 host/admin 规则，但与「accounts 不开放自助注册」安全姿态不一致 → 把 `users` createRule/updateRule 锁为 `NULL`（graceful no-op：未来 PB 移除默认 users 则跳过）。
2. **`hooks.go` `parseWinLoseList` 修复**：原 type switch `case []byte:` 不匹配命名类型 `types.JsonRaw`（Go 类型 switch 只匹配精确类型）→ 返回 nil → `countWins=0` → `delta=0` 被 NumberField Required 拒为 blank → match POST 返回 400、hook 不派生 scores。改为 **marshal→unmarshal 统一规整**，覆盖 `[]any`/`[]byte`/`string`/`types.JsonRaw` 全形态。
3. **`1782000001_init_collections.go` scores 规则修复**：原 `scores.CreateRule/UpdateRule/DeleteRule = nil`（仅 superuser/hook 可写）与契约 validation「admin 能改 scores（curl 逐条验）」+ research-backend-p5 §1.6 矩阵（scores create/update/delete = `@request.auth.role='admin'`）冲突 → 改为 admin-only 规则（hook 仍用 `app.Save` 绕过规则写，不受影响）。

### 全 done-when proof 通过（`backend/verify-all.sh` 一键复现）

| done-when | 实测证据 | 结果 |
|---|---|---|
| PocketBase 起跑 + Admin UI + 5 集合 | Server started, Dashboard /_/, 5 collections（accounts/players/matches/scores/logs） | ✅ |
| migrations 从零重放 | `rm -rf pb_data && migrate up` → Applied 1782000001 + 1782000002 | ✅ |
| host POST matches | HTTP 200，match id 派发 | ✅ host 可写 |
| viewer 不能写 | HTTP 400（规则拒绝，empty data），matches 计数未增 | ✅ blocked |
| admin 能改 scores | HTTP 200，score 记录创建（delta=5） | ✅ admin 可写 |
| logs 不可改不可删 | HTTP 403「Only superusers can perform this action」 | ✅ immutable |
| hook match→scores+logs | match create 后派生 2 条 scores（delta=2.4 each），reason=`wins=2 × coef=1.20 (std12) season=2026S1`；score.adjust + match.create 审计条 | ✅ |
| practice 不派生 scores | practice match 后 scores 查询 totalItems=0 | ✅ |
| 天梯聚合 SUM(delta) GROUP BY player | P1=9.8（2.4+5+2.4）、P2=4.8（2.4+2.4），season=2026S1 | ✅ |
| SQLite 导出 | `cp data.db + wal + shm` → sqlite3 可查 matches/scores/logs/players/accounts | ✅ |
| 部署产物齐 | nginx /api 反代（含 SSE+AdminUI）+ systemd unit + Dockerfile + litestream.yml + runbook.md | ✅ |
| schema↔live 映射表 | README 上方「schema ↔ live 同形映射表」段 | ✅ |

### 已知响应码说明（非 bug）

- PocketBase v0.39.4 **表达式规则拒绝**（如 viewer POST match、host POST scores）返回 `400 {"data":{},"message":"Failed to create record."}`（empty data，无字段错误）；**nil 规则拒绝**（如 logs update/delete）返回 `403 "Only superusers can perform this action."`。两者均「未持久化」，安全姿态正确（viewer/host-scores 被 block，matches/scores 计数证明未建）。

### caveat（待 hub/yb 拍板）

1. **CF Pages 跨域 vs devbox nginx 同源**：本 round 只在 devbox 内做 `/api` 同源反代；CF Pages 前端连后端的公网暴露受内网穿透红线约束，须 SRE 走 TLB，是独立后续事项。
2. **payload_code 编码器归属**：P3 codec 已落地（`web/src/logic/codec.ts`，schema v1 冻结，9 模式+双打往返 e2e 绿），P5 `matches.payload_code` 可直接复用同一编码器。本 round 只定字段 + max 512。
3. **积分难度系数表未定稿**：当前取最简（std8=1.0…rescue/hard=1.3，纯累加）+ 系数配置化（`config/scoring.json`，改 JSON 重启即生效不重编译）。真实系数（点金×2/双打/连胜/赛季周期）须 yb/土豆拍板，schema 用 `delta+reason+season` 已留足空间，系数改不动 schema，但天梯上线前必须定稿。
4. **harness-pro reviewer pillar**：本轮 DUBHE_API_KEY/BASE 未注入 env，real reviewer（claude-code-host backend 经 Dubhe 调模型）无法 dispatch。确定性验证（上表全 ✅）是真 gate，reviewer 走 advisory；如需 native_harness_pass，hub 注入 Dubbe key 后重跑 `npx harness-pro review`。

# 集结杯 · 运维（Operations）

> 范围：账号体系 / 选手注册 / 赛季 / 系数 / 天梯 / 常见操作 / FAQ。
> 真相源：`backend/config/scoring.json`（系数）/ `backend/pb_migrations/1782000001_init_collections.go`（schema）/ `mode-rules-truth-table.md`（赛制真相）。

---

## 0. 用户角色

| 角色 | accounts.role | 能做什么 | 不能做什么 |
|---|---|---|---|
| **观众**（anon） | — | 看 home / select / obs / ladder / result（公开读） | 写任何记录 |
| **选手**（隐式） | — | 走 player_code 锚定身份，看自己的天梯 | — |
| **主播** | `host` | 登录、录入选手（players）、录入对局（matches） | 写 scores（hook 自动）、改 logs |
| **管理员** | `admin` | 全部：调分、查日志、改账号、切赛季、改系数 | — |

> 账号权限矩阵（API Rules）严格按 `pb_migrations/1782000001_init_collections.go` 实现。

---

## 1. 主播账号体系

### 1.1 创建主播（admin 操作）

```bash
# 方式 A：admin UI（推荐）
# http://10.37.220.128:8080/_/ → accounts 集合 → New record
#   email: <主播邮箱>     (例 host-tudou@jjb.test)
#   password: <一次性随机>  (例 Tudou@2026!)
#   passwordConfirm: 同上
#   role: host
#   display_name: 主播土豆
# 保存即生效，token 立即可用（前端 pbAuth 调 /api/collections/accounts/auth-with-password）

# 方式 B：verify-all.sh 造测试账号（仅 dev/联调用）
cd backend && ./verify-all.sh
# 产物：admin@jjb.test / host@jjb.test / viewer@jjb.test
```

### 1.2 主播登录

```js
// 前端（web/src/logic/backend.ts）
const r = await fetch('/api/collections/accounts/auth-with-password', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identity: 'host@jjb.test', password: 'Host123456!' }),
});
// → { token, record: { id, role, display_name } }
// token 仅内存，不落盘；登出 → clearAuth()
```

### 1.3 主播密码重置

```bash
# 临时 admin 改密码（PB CLI）
ssh 10.37.220.128
sudo -u jjb /opt/jjb-backend/pocketbase admin \
  --dir /opt/jjb-backend/pb_data \
  upsert-host-password  # 注：PB 没有直接命令，需走 Admin UI

# 实际：Admin UI → accounts 集合 → 选中 host 记录 → 改 password + passwordConfirm → 保存
```

### 1.4 主播离职 / 账号注销

- Admin UI → accounts → 选中 host 记录 → **Delete**（仅 admin 可删）
- 软删除建议：直接改 `display_name` 加 "[已离职]" 后缀，**保留记录**（matches.host 关系字段需要保留外键完整性）。

---

## 2. 选手注册

### 2.1 谁可注册

- **主播**：可创建 / 改 player 记录
- **管理员**：可创建 / 改 / 删 player 记录
- **观众**：无注册入口（players 集合 CreateRule 限制）

### 2.2 注册流程

```bash
# Admin UI / 主播 UI → players → New record
#   nickname:        <昵称，可改>
#   player_code:     <稳定锚，唯一>   例：P001 / 工号 / B站UID（不可改）
#   race_pref:       t | z | p（主玩种族）
#   avatar:          上传头像（可选，前端用族徽占位兜底）
#   active:          true / false（false = 不计入天梯 active=1 过滤）
#   notes:           备注（可选）
```

**关键**：**player_code 是稳定锚**，昵称可改、code 不可改。所有天梯展示 / 直播横条锚定都走 player_code。

### 2.3 选手关联到对局

```js
// 提交对局时（matches.players 多关系）
POST /api/collections/matches/records
{
  "mode": "match",
  "game_mode": "std12",
  "payload_code": "...",
  "payload_ver": 1,
  "players": ["<player_id_1>", "<player_id_2>"],  // 用 player.id，不是 player_code
  "host": "<host_account_id>",
  "result": [1, 2, 0],
  "score_total": 2,
  "bp_config": {...}
}
```

> 双打 2 人（jjbDoubles `_slots`），多关系字段；schema 留 MaxSelect=20 余量。

### 2.4 选手退役

- Admin UI → players → 改 `active = false`（从 0/1 过滤）
- 保留历史 matches.players 关系（不删），历史天梯数据仍可查（聚合 query 仍包含旧 score 行）；只是当前天梯榜不再显示。

---

## 3. 赛季 / 系数 / 积分

### 3.1 赛季（season）

- **赛季标识**：`backend/config/scoring.json` 的 `current_season`（默认 `"2026S1"`，待 yb 定）
- **聚合键**：`scores.season` 字段（hook 写入时取 `currentSeason()`）
- **切换赛季**：改 `config/scoring.json` → 重启 backend → 新对局用新 season，旧对局仍可按历史 season 聚合
- **查历史赛季天梯**：`GET /api/rankings?season=2025S2`

### 3.2 系数（coefficients）

| game_mode | 当前系数 | 含义 |
|---|---|---|
| `std8` / `std10` / `std12` | 1.0 / 1.1 / 1.2 | 标准 8/10/12 因子 |
| `rescue` | 1.3 | 拯救（难度加成） |
| `one-a` | 1.1 | 指挥官一选一 |
| `hard1` / `hard2` | 1.3 / 1.3 | 极难 |
| `feiqiu` / `suiji` | 1.0 / 1.0 | 非酋 / 完全随机 |
| `doubles` / `feiqiu-doubles` | 1.0 / 1.0 | 双打 + 非酋双打 |
| **default_coefficient** | 1.0 | 未知 game_mode 兜底 |

**修改流程**：
```bash
# 1. 改配置（devbox 上）
ssh 10.37.220.128
vim /opt/jjb-backend/config/scoring.json
# 例：把 "std12": 1.2 改成 1.5（更难的赛季）→ 保存

# 2. 重启 backend 加载新配置
sudo systemctl restart jjb-backend

# 3. 验证
curl -s http://127.0.0.1:8090/api/scoring | python3 -m json.tool
# 检查 coefficients.std12 是否已更新
```

> **不动 schema**：改系数改 JSON + 重启即生效，不重编译 Go；scores.delta/reason/season 已留空间。

### 3.3 积分算法

```
delta = 获胜场 × coefficients[game_mode]
获胜场 = countWins(result)  // v==1 (win) || v==2 (bonus) 计数，win+bonus 不双计
season = currentSeason()     // 兜底 "default"
```

- **mode=practice → 跳过算分**（不派生 scores，不进天梯）
- **mode=match → 算分**：hook `scoreMatch` 为每个 player 写一条 scores（delta / wins / games / reason / season）

### 3.4 手动调分

```js
// admin-only（P5 集合规则 + 业务惯例：重大争议时 admin 手动加/扣分）
POST /api/collections/scores/records
Authorization: <admin_token>
{
  "player": "<player_id>",
  "match":  "<match_id>",       // 可关联到对局（reason 说明手动）
  "delta":  5,
  "reason": "admin-manual-adjust: <理由>",
  "season": "2026S1",
  "wins":   0,                  // 可选（手动调分通常无 wins/games）
  "games":  0
}
```

> **审计**：手动调分会进 logs（`score.adjust`），reason 字段必填。

---

## 4. 天梯（rankings）

### 4.1 查询

```bash
# 当前赛季天梯
curl -s http://127.0.0.1:8080/api/rankings

# 历史赛季
curl -s 'http://127.0.0.1:8080/api/rankings?season=2025S2'
```

返回结构：
```json
{
  "season": "2026S1",
  "count": 12,
  "rankings": [
    {
      "player_id": "...",
      "nickname": "选手甲",
      "player_code": "P001",
      "race_pref": "t",
      "total_delta": 9.8,
      "total_wins": 7,
      "total_games": 12,
      "match_count": 5
    },
    ...
  ]
}
```

字段含义：
| 字段 | 含义 |
|---|---|
| `total_delta` | 累计积分（SUM scores.delta） |
| `total_wins` | 累计胜场（SUM scores.wins，件1 真实化） |
| `total_games` | 累计总局数（SUM scores.games） |
| `match_count` | 参赛局数（COUNT scores.id）— 兼容/调试用，前端不再作主战绩列 |

### 4.2 排序与展示

- 后端：`ORDER BY total_delta DESC, p.nickname ASC`（同分按昵称字母序）
- 前端：LadderScreen 接收 `rankings[]`，按数组下标赋 rank（同分同号）

### 4.3 公开读

天梯 **无需 auth**（公开 read），直播/观众无登录可看；前端 LadderScreen 直接 `fetch /api/rankings`。

### 4.4 战绩真实化（件1）

> 历史背景：原 rankings 用 `COUNT(s.id) = match_count` 占位"赛季对局"，**与真实胜场不符**。

**真实化（已落，件1）**：
1. migration `1782000003_scores_wins_games.go`：`scores` 加 `wins` / `games` 字段（幂等：字段已存在跳过）
2. hook `scoreMatch`：`scores.wins = countWins(result)`、`scores.games = len(result)`
3. `routes.go rankingsHandler`：改 `SUM(s.wins)` / `SUM(s.games)` 返 `total_wins` / `total_games`
4. 前端 LadderScreen：显「胜/总」战绩

**旧记录兼容**：旧 score 记录 `wins/games` 为 nil → `COALESCE(SUM(wins), 0)` 兜底 0（旧选手战绩显 0/0 不报错，delta 积分仍正常聚合）。

---

## 5. 日常运维操作

### 5.1 加一场比赛（主播 UI 流程）

```bash
# 1. 登录（accounts.auth → token）
# 2. 选选手（GET /api/collections/players/records?perPage=200）
# 3. 录入对局（POST /api/collections/matches/records）
# 4. 等 hook 派生 scores（约 0.3s 后 GET /api/collections/scores/records 可见）
# 5. 看天梯（GET /api/rankings 验证 total_delta 增长）
```

### 5.2 选手没上榜？

```bash
# 检查 1：active 是否 true
curl -s "http://127.0.0.1:8080/api/collections/players/records?filter=(nickname='xxx')" | jq '.items[0].active'
# 若 false → 改 true

# 检查 2：是否有 scores（可能 mode=practice 不派生）
curl -s "http://127.0.0.1:8080/api/collections/scores/records?filter=(player='<id>')&perPage=5"

# 检查 3：season 是否匹配
# 旧赛季 score 不在当前 season 聚合里；用 ?season= 历史查
curl -s "http://127.0.0.1:8080/api/rankings?season=<旧>"
```

### 5.3 重算某场比赛积分

```bash
# 场景：系数改了 / result 录错想重算
# 方式 A：删 match + 重新录入
#   DELETE /api/collections/matches/records/<id>  （admin-only）
#   关联 scores CascadeDelete=true 自动删
#   重新 POST match → hook 重新派生

# 方式 B：admin 手动加一条 score（调整 delta）
#   POST /api/collections/scores/records（admin-only）
#   reason 必填，说明手动调分原因
```

### 5.4 查审计

```bash
# 全部 logs（admin-only）
curl -s -H "Authorization: <admin_token>" \
  "http://127.0.0.1:8080/api/collections/logs/records?perPage=50&sort=-created"

# 按 action 过滤
curl -s -H "Authorization: <admin_token>" \
  "http://127.0.0.1:8080/api/collections/logs/records?filter=(action='score.adjust')"
```

### 5.5 数据库备份 / 导出

```bash
# 1. 在线导出（SQLite WAL 模式：复制 db + wal + shm 三件套）
ssh 10.37.220.128
cp /opt/jjb-backend/pb_data/data.db      /tmp/jjb-export.db
cp /opt/jjb-backend/pb_data/data.db-wal  /tmp/jjb-export.db-wal 2>/dev/null || true
cp /opt/jjb-backend/pb_data/data.db-shm  /tmp/jjb-export.db-shm 2>/dev/null || true

# 2. 本地查询
sqlite3 /tmp/jjb-export.db ".tables"
sqlite3 /tmp/jjb-export.db "SELECT nickname, player_code, active FROM players"
sqlite3 /tmp/jjb-export.db "SELECT COUNT(*) FROM matches"
```

> **不要只复制 data.db**：WAL 模式下，未提交的写可能在 wal/shm 里；**三件套一起复制**才能保证一致性。

---

## 6. 常见问题排查（FAQ）

### Q1：前端 fetch /api 报 CORS？

**答**：浏览器应该不会报 CORS —— 同源（都走 8080）。如报：
- 检查 nginx conf 是否生效：`curl -i http://127.0.0.1:8080/api/health`
- 检查 backend 是否在 8090 监听 `0.0.0.0`（不是 `127.0.0.1`）：`journalctl -u jjb-backend | grep listening`
- 检查容器是否走 docker0 网关：`grep proxy_pass /etc/nginx/conf.d/default.conf`（容器版应是 `172.17.0.1:8090`）

### Q2：主播登录后报 403？

**答**：检查 role：
- viewer 不能写 matches / scores
- host 不能写 scores
- host 只能改自己主持的 match（`@request.auth.id = host`），改别人的需要 admin

### Q3：hook 没派生 scores？

**答**：
- 检查 match.mode 是否 `match`（`practice` 不派生）
- 检查 match.result 是否合法 JSON 数组 `[0|1|2,...]`
- backend 日志：`journalctl -u jjb-backend -n 50 | grep scoreMatch`

### Q4：天梯 SUM(delta) 与预期不符？

**答**：
- 检查 season：是否用了 `?season=` 过滤了
- 检查 player.active：false 的选手不计入（query 有 `WHERE p.active = 1`）
- 检查 mode：practice 不派生，practice 的 delta=0 是正常

### Q5：前端 dev 起 vite 后访问 503？

**答**：
- vite dev 默认代理 `/api` → `127.0.0.1:8090`（见 `web/vite.config.ts`）
- 如果 backend 没起 → 报 ECONNREFUSED
- 解决方案：`cd backend && ./pocketbase serve --http 127.0.0.1:8090 &`

### Q6：admin 打不开 /admin/？

**答**：
- 检查 admin build：`admin/dist/index.html` 是否存在
- 检查 nginx alias：`grep "location /admin/" /etc/nginx/conf.d/default.conf` 应为 `alias /admin/dist/;`（容器版）
- 容器内路径：`/admin/dist/index.html`（admin 挂载点）

### Q7：cloudflared URL 每次重启变？

**答**：这是 quick tunnel 的固有限制（每次新 ephemeral 命名）。**长期方案**：CF Pages（外部静态托管）— 已有 `web/public/_redirects` 预置。详见 [deployment.md caveat 1](deployment.md#10-已知-caveat部署层--待-hubyb-拍板)。

### Q8：怎么切到下个赛季？

**答**：
```bash
# 1. 改 config/scoring.json
ssh 10.37.220.128
vim /opt/jjb-backend/config/scoring.json
# "current_season": "2026S1" → "2026S2"
# （按需同步调 coefficients）

# 2. 重启
sudo systemctl restart jjb-backend

# 3. 验证
curl -s http://127.0.0.1:8090/api/scoring | jq .current_season
# → "2026S2"

# 4. 历史 season 天梯仍可查
curl -s 'http://127.0.0.1:8090/api/rankings?season=2026S1'
```

### Q9：怎么查某场比赛用了什么因子 / 指挥官？

**答**：
- **方式 A**：用 `payload_code`（codec 自包含码，含 mode + 地图 + 锁定因子 + 指挥官 + 因子）
  - 前端码方案屏（?screen=code&code=paste）→ 粘贴 → applySnapshot 还原同盘
  - 或：开发时直接读 `codec.decodePayload(payload_code)` 解析
- **方式 B**：match.result 只存胜负（`[1,2,0,...]`），不含具体因子名；要溯源 → 看 payload_code

### Q10：主播密码忘了？

**答**：admin 走 Admin UI → accounts → 选中 → 改 password + passwordConfirm → 保存。前端重新登录即可。

---

## 7. 红线 / 强约束

1. **0 改 schema 加列**：现有 5 集合字段已是定稿；加列需走 schema migration（新 `1782000xxx_xxx.go`）+ 修改对应 `xxFields.Add` + 改 hook + 改 routes。
2. **logs 不可改删**：`updateRule = nil` + `deleteRule = nil`，API 层硬约束（即便 admin 也 403）。
3. **mode=practice 不计分**：hook 早 return；前端 / admin 不会误算分。
4. **scores 写仅 hook**：scores.CreateRule = admin-only（前端不直接 POST），hook 用 `app.Save` 绕过。
5. **player_code 不可改**：unique 索引；改 nickname 频繁，改 code 严禁（外部锚定用 code）。
6. **系数表改不动 schema**：改 `config/scoring.json` 重启即生效；改 schema 反而破坏历史 score 数据。

---

## 8. TODO（待补 / 留后续 round）

- [ ] **系数表定稿**：当前最简纯累加；点金 ×2 / 连胜加成 / 赛季周期 须 yb/土豆拍板。
- [ ] **赛季自动切**：当前手动改 JSON 重启；后续可加 admin UI 切赛季按钮。
- [ ] **天梯分页**：当前 `/api/rankings` 全量返；选手多时需分页 / 懒加载。
- [ ] **审计搜索**：logs 当前 admin UI 全量列；缺搜索框（按 actor / action / target / 时间范围）。
- [ ] **赛季排行榜归档**：每赛季末快照存档（独立 season_rankings 表），避免 scores 累积过久。
- [ ] **OBS 横条文档**：obs 屏三形态 URL 与旗标语义留 jjb-run-broadcast skill（已有），本 docs 不复述。
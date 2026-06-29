# 集结杯 P5 后端实施细化 + /goal spoke 派发契约草稿

> 真相基线：`tmp/platform-research-report.md`（§1/§2/§5）+ `projectplan.md`（2026-06-22 P1 收官 / 6 Phase 路线图 / 数据 schema / 开放问题决策）+ live 代码核对（`web/src/logic/{jjbSession,jjbView,jjbDoubles}.ts`、`legacy/JijieData.ts`、`HomeScreen.tsx`）。
> 当前分支 `jjb-platform`（本地领先 origin），P0 清场 + P1 入口分流/BP 已完成。本文档不写任何代码、不改状态——产出实施细化 + 可直接粘贴的派发契约。
> **关键 live 校正**：研报 §5 的 schema 与 live 选择状态字段需对齐——单打权威态是 `SelectState`（`jjbSession.getSelectState()`），双打是独立模块级 `_slots`+`DoublesConfig`（`jjbDoubles`），二者经 `jjbView.ts` 门面统一。`payload_code` 必须能编码**两条**路径，不能只按单打设计。

---

## 1. PocketBase 落地（5 集合 schema + 记录级权限 + Go hook）

### 1.0 设计总纲（先确立 3 条不变量）

1. **`matches.payload_code` 单字段存整局**，不展开 mutator/因子为表结构。依据：live 选择状态本质是「指向 `mutatorPool`/`commanderList`/`config` 枚举的少量索引」，单打 `SelectState` + 双打 `_slots` 索引化后 ~100–150 bytes。**与码方案（P3）复用同一编码器**——主播可「贴码开局」，比赛/分享两条路径统一。
2. **天梯不建表** = `scores` 按 `season` 聚合（`SUM(delta) GROUP BY player`）；只在读热点高时由 Go hook 维护一张物化 `rankings` 缓存，非第一性集合。
3. **练习默认不落库**（开放问题已拍板）——`mode=practice` 仅「选手主动保存」才写 `matches`，比赛 `mode=match` 必落。这把 SQLite 写压力锁在比赛域。

### 1.1 `players` 选手表（独立集合，非 auth）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `nickname` | text | required, max 40 | 选手昵称，直播展示。对齐 live `JijieData.playerName`（首页 `HomeScreen` 选手 ID 输入框写入）|
| `player_code` | text | **unique**, required | 选手稳定 ID（报名号/工会号），ObsBar 直播展示的稳定锚（昵称可改、code 不可改）|
| `race_pref` | select(单选) | `t`/`z`/`p`, optional | 主玩种族；对齐 live 三族体系（`RaceCode` / `race-{protoss,terran,zerg}.png`）|
| `avatar` | file 或 url | optional, 单文件 | 头像（PocketBase file 字段自带存储；不传则前端用族徽占位）|
| `active` | bool | default true | 是否在役（天梯过滤）|
| `notes` | text | optional | 备注 |

> 选手与 `accounts`（主播）**解耦**：选手是被展示/计分的实体，主播是操作者。一个主播主持时为多名选手记分，二者多对多经 `matches` 关联。

### 1.2 `matches` 对局表（比赛+练习共用，`mode` 分流）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `mode` | select | `practice`/`match`, required | **入口分流落库点**，对齐 live `setRuleMode('practice'\|'match')`（`HomeScreen` 比赛/练习 tab）|
| `game_mode` | text | required | 赛制模式标识，**直接存 live `SessionMode` 字符串**：`std8`/`std10`/`std12`/`rescue`/`one-a`/`hard1`/`hard2`/`feiqiu`/`suiji`/`doubles`/`feiqiu-doubles`（11 种，权威源 `jjbSession.ts:64`）|
| `payload_code` | text | required, max 2048（联调修正：初稿 ~512 偏小，codec 实测自包含码≤858，见「P5↔前端联调」） | 整局选择的**索引化码**，与 P3 码方案同一编码器产出。单局完整可还原（指挥官/锁定因子/自选因子/地图/敌方种族AI/模式）|
| `payload_ver` | number | required | 码 schema 版本号；池重排时解码侧校验（见研报开放问题 #2）|
| `players` | relation→players | multi, optional | 参与选手；练习可空/匿名，双打 2 人 |
| `host` | relation→accounts | single, optional | 主持该局的主播账号；练习模式可空 |
| `result` | json | optional | 每场胜负数组，**直接存 live `winLoseList`**：`[0\|1\|2,…]`（`RESULT_VAL`：lose0/win1/bonus2，`jjbSession.ts` 权威）|
| `score_total` | number | optional | 本局获胜场数 = `getScore()`（win+bonus 计数，**不双计** bonus，对齐 live `jjbSession.getScore()`）|
| `bp_config` | json | optional | 本局 BP 规则**快照**（`ruleMode` + 违规判定结果），防 BP 规则后续演进失真 |
| `started_at` / `ended_at` | date | optional | 起止时刻 |

> **`game_mode` 直存 `SessionMode` 字符串**而非研报模糊的「A4B2 等」——live 真相是 11 枚举字符串，存原值最省、与前端零翻译、与码方案天然一致。双打两值 `doubles`/`feiqiu-doubles` 同样直存。

### 1.3 `scores` 积分表

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `player` | relation→players | single, required | 选手 |
| `match` | relation→matches | single, required | 来源对局 |
| `delta` | number | required | 本局得分增量（Go hook 算，见 1.6）|
| `reason` | text | optional | 计分依据（胜N场/难度系数/点金×2/赛制…，可追溯）|
| `season` | text | required, index | 赛季标识（天梯分赛季聚合键）|

> 一条 match 可派生多条 `scores`（双打 2 选手各一条）。`delta` 与 `match.score_total` 区别：后者是裸获胜场数，前者是经积分算法（难度系数等）换算后的天梯分。

### 1.4 `logs` 操作日志表

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `actor` | relation→accounts | optional | 操作者；系统事件可空 |
| `action` | text | required | 事件类型：`match.create`/`score.adjust`/`login`/`config.reload`/`player.create`… |
| `target_type` / `target_id` | text | optional | 受影响实体类型 + ID |
| `detail` | json | optional | 结构化上下文（前后值 diff 等）|
| `ip` | text | optional | 来源 IP |

> 写入策略：关键变更由 Go hook **自动埋点**（onRecordAfterCreate/Update），非前端逐条 POST——前端只管业务写，审计由后端钩子兜底，防漏记。

### 1.5 `accounts` 账号表（主播权限，PocketBase 内置 auth 集合）

直接用 PocketBase **内置 auth collection**（`email`/`password`/`verified`/`tokenKey` 系统字段自带），扩 2 个自定义字段：

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `role` | select | `admin`/`host`/`viewer`, required | 权限角色 |
| `display_name` | text | required | 主播展示名 |

角色语义：
- `admin` — 管账号 + 改积分 + 全部写
- `host` — 主持比赛、写对局、记分（不能直接改他人积分明细）
- `viewer` — 只读（看天梯/对局，不写）

### 1.6 记录级权限规则（PocketBase API Rules，零代码）

PocketBase 每个集合有 `listRule`/`viewRule`/`createRule`/`updateRule`/`deleteRule`，用表达式语言写。规则矩阵：

| 集合 | list/view（读）| create（建）| update（改）| delete（删）|
|---|---|---|---|---|
| `players` | `""`（公开，直播展示需匿名可读）| `@request.auth.role = "host" \|\| @request.auth.role = "admin"` | 同 create | `@request.auth.role = "admin"` |
| `matches` | `""`（公开读，观众/直播）| `@request.auth.role = "host" \|\| @request.auth.role = "admin"` | `@request.auth.id = host.id \|\| @request.auth.role = "admin"`（仅本人主持的局或 admin）| `@request.auth.role = "admin"` |
| `scores` | `""`（公开，天梯展示）| `@request.auth.role = "admin"`（Go hook 用 admin/superuser 上下文写，**前端不直接 POST scores**）| `@request.auth.role = "admin"` | `@request.auth.role = "admin"` |
| `logs` | `@request.auth.role = "admin"`（审计仅 admin 可读）| 同上（hook 写）| `null`（不可改，审计完整性）| `null`（不可删）|
| `accounts` | `@request.auth.role = "admin"` | `@request.auth.role = "admin"`（不开放自助注册）| `@request.auth.id = id \|\| @request.auth.role = "admin"`（改自己或 admin）| `@request.auth.role = "admin"` |

> 关键纪律：
> - **读默认公开**（`players`/`matches`/`scores`）——直播横条/观众页需无登录可拉数据，攻击面仅「读」，无敏感数据。
> - **`scores` 不接受前端直接写**：积分必须经 Go hook 在 match 落库后服务端计算（防客户端伪造分数）。`createRule` 设 admin-only，hook 用 superuser dao 绕过规则写。
> - **`logs` 不可改不可删**：审计完整性，`updateRule`/`deleteRule` 设 `null`（永远拒绝）。

### 1.7 Go hook（积分计算 + 天梯聚合 + 审计埋点）

PocketBase v0.22+ 用 Go 嵌入（`pocketbase.New()` + `app.OnRecordAfterCreateRequest(...)`）或 JSVM（`pb_hooks/*.pb.js`）。**推荐 Go 嵌入**（单一二进制、类型安全、与「随产物推二进制」一致）。三个钩子：

**Hook A — 对局落库后算积分（`OnRecordAfterCreateSuccess("matches")`）**
```
触发：matches 新记录 created 且 mode == "match"（practice 跳过）
逻辑：
  1. 解析 record.result（winLoseList JSON） → win+bonus 计获胜场 wins
  2. 查 game_mode → 难度系数 coef（最简版：std8=1.0 / std10=1.1 / std12=1.2 / rescue/hard*=1.3 / doubles=1.0…，系数表配置化）
  3. delta = wins * coef（最简纯累加，开放问题 #1 拍板：Elo 后续）
  4. 对每个 players 关系项，用 superuser dao 写一条 scores{player, match, delta, reason, season=当前赛季}
  5. 写 logs{action:"score.adjust", detail:{wins,coef,delta}}
```

**Hook B — 天梯聚合刷新（可选物化缓存）**
```
触发：scores afterCreate
逻辑：增量更新 rankings 缓存集合（player+season → SUM(delta)）
  低流量阶段可省略此 hook，天梯页直接对 scores 跑聚合查询（PocketBase 自定义路由 /api/rankings）
```

**Hook C — 审计埋点（`OnRecordAfter{Create,Update}Success` 通配）**
```
触发：matches/players/accounts 的 create/update
逻辑：写 logs{actor:auth.id, action:"<col>.<op>", target_type/id, detail:diff, ip}
```

> 积分系数表 + 赛季标识做成 PocketBase `settings` 集合或环境配置，**不硬编码进 hook**——开放问题 #1 留了「Elo 后续迭代」口，系数可调不重编译（JSVM 路线可热改；Go 路线走配置集合读取）。

---

## 2. 部署（二进制随产物推 + docker/裸进程 + 持久卷 + nginx /api + Litestream）

### 2.0 部署约束真相（projectplan 实证）

- 目标机 = **devbox-tianlang `10.37.220.128`**，docker nginx 监听 **8080**，静态托管 `web/dist`（`jjb-deploy` 链路）。
- **开发机外网受限、拉镜像难是最大障碍**——PocketBase/Litestream 二进制**本地下好随产物一起 scp 推**，不在开发机现拉。
- **打公网严禁内网穿透**（红线政策 `wiki/JgcDwFXT9iXzGHk9G74c3L3ynid`）；正解 = 外部静态托管（CF Pages）+ 后端经 nginx `/api` 同源反代。

### 2.1 二进制分发（绕开外网受限）

```
本地（有外网）：
  下载 pocketbase_<ver>_linux_amd64（~15MB）+ litestream_<ver>_linux_amd64（~7MB）
  → 随 web/dist 产物一起 scp 到 devbox（与现有部署 SOP 同信道）
devbox（外网受限）：
  二进制 + pb_data 持久卷就位，不依赖任何 registry pull
```

### 2.2 运行形态：裸进程优先（比 docker 更契合受限环境）

研报给了「第二个 docker 容器或裸进程」两选项。**推荐裸进程 + systemd/supervisor 守护**：

- 理由：避免在受限机上拉 base image；PocketBase 是静态二进制，裸跑零依赖；持久卷直接挂宿主目录最简。
- 形态：
  ```
  /opt/jjb-backend/pocketbase serve --http 127.0.0.1:8090 --dir /opt/jjb-backend/pb_data
  数据目录 /opt/jjb-backend/pb_data/  ← 持久卷（SQLite 文件 + 上传文件 + migrations）
  ```
- docker 备选：若部署 SOP 强制容器化，用 `alpine` + COPY 本地二进制的极简 Dockerfile（不 apk pull 业务依赖），`-v /opt/jjb-backend/pb_data:/pb/pb_data` 挂卷，与现 nginx 容器同 network 或经 host 127.0.0.1 通信。

### 2.3 nginx /api 反代段（加在现有 8080 server 块）

```nginx
# 现有 8080 server 块内追加（不动 location / 的静态托管）
location /api/ {
    proxy_pass http://127.0.0.1:8090;          # PocketBase
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    # PocketBase realtime（SSE）需要：
    proxy_set_header Connection '';
    proxy_buffering off;
    proxy_read_timeout 86400s;
}
```

> 前端 `fetch('/api/...')` 同源 → 免 CORS。PocketBase REST 默认前缀即 `/api/`（`/api/collections/{col}/records`、`/api/collections/accounts/auth-with-password`），与此反代天然对齐，**前端 baseURL 直接用 `/api`**。

### 2.4 CF Pages（前端外部托管）与同源问题

- CF Pages 托管 `web/dist`，但后端在 devbox——**跨域**。两条解法：
  - **(a) 同源代理**：CF Pages 不直连 devbox 后端，改由 devbox nginx 同时托管前端（现状）+ `/api`，CF Pages 仅作镜像/备用。
  - **(b) CF 侧反代**：CF Pages Functions / `_redirects` 把 `/api/*` 代理到 devbox 公网入口（但 devbox 公网入口受内网穿透红线约束，需 SRE 走 TLB 正规流程，重）。
- **当前阶段建议 (a)**：后端就近 devbox nginx 同源，CF Pages 路线先保前端静态托管不动，`/api` 接入以 devbox 8080 为汇流点。公网后端暴露走 SRE 是后续独立事项，不阻塞 P5 本地/devbox 内联通。

### 2.5 Litestream 容灾（→ 对象存储）

```yaml
# /opt/jjb-backend/litestream.yml
dbs:
  - path: /opt/jjb-backend/pb_data/data.db
    replicas:
      - type: s3                          # 或国内 OSS S3 兼容端点
        bucket: jjb-backend-backup
        path: pb_data
        endpoint: <S3兼容endpoint>        # OSS/MinIO/COS S3 兼容
        # access-key-id / secret 走 env，不落盘不进 git
```
```
裸进程守护：litestream replicate -config /opt/jjb-backend/litestream.yml
灾难恢复：litestream restore -o pb_data/data.db s3://jjb-backend-backup/pb_data
```

> Litestream 实时增量复制 SQLite WAL，服务器炸了从桶恢复最多丢几秒——补齐「数据自掌控 + 灾难恢复」最后一块，关掉「生产 SQLite 不可靠」老问题。**密钥仅走 env**（对齐 dispatch hard rule 9，不落盘不进 git）。

---

## 3. 前端对接（fetch /api 落库 + 选手 ID 数据流 + 练习边界 + 复用码方案）

### 3.0 接缝层定位（live 真相）

- 统一门面 = **`web/src/logic/jjbView.ts`**（已存在）：`currentMatches()`/`currentScore()`/`currentTotal()`/`currentPlayerName()`/`currentSessionMode()` 已封装单打/双打分流。**后端对接的读写都挂在 logic 层新增模块**（如 `web/src/logic/backend.ts`），不散落进 screens。
- 选择状态权威读出 = `getSelectState()`（单打 `SelectState`）+ `getDoublesState()`（双打 `DoublesConfig`+`_slots`）。
- 结果态 = `winLoseList`（`result`）+ `getScore()`（`score_total`）。
- 这些**全是纯前端已有导出**，P5 前端侧只新增「编码 + POST」一层，零改既有引擎（对齐 Cocos/legacy 冻结红线）。

### 3.1 比赛模式落库一局（payload_code 单字段）

数据流（仅 `ruleMode==='match'` 且一局判定满 3 场时触发）：
```
SelectScreen/BattleScreen 一局结束
  → 收集：单打 getSelectState() | 双打 getDoublesState()
  → encodePayload(state) → base64url 短码（与 P3 码方案同一编码器，带 ver）
  → POST /api/collections/matches/records {
        mode:'match', game_mode:<SessionMode>,
        payload_code:<码>, payload_ver:<v>,
        players:[<player record ids>], host:<auth.id>,
        result:<winLoseList>, score_total:<getScore()>,
        bp_config:{ruleMode, warns快照}, started_at, ended_at
     }
  → Go hook A 服务端算分写 scores（前端不碰 scores）
  → 前端回读 /api/.../matches/<id> 确认落库
```

> **payload_code 必须双路径**：单打编码 `{mode, mapList, lockFactorList, selectedCommanderList, selectedFactorList, modeFlags, enemyRace/Ai}`；双打编码 `{variant, matchMaps, matchMutators, _slots(cmds+factors), commanderPool选择}`。编码器用「稳定名 + 版本」而非纯下标（开放问题 #2：池追加不重排纪律，旧码不错位）。

### 3.2 选手 ID 直播展示数据流

```
报名阶段：主播在比赛 tab 录入选手 → POST /api/collections/players/records {nickname, player_code, race_pref}
开局：HomeScreen 选手 ID 输入 → 关联 player_code → 写 JijieData.playerName（live 现状）+ 记 match.players 关联
直播横条 ObsBar：currentPlayerName()（现走 JijieData.playerName）
  → 接后端后：GET /api/collections/players/records?filter=(player_code='<code>') 拉稳定 nickname/avatar/race
  → 横条展示稳定选手 ID（昵称可改、player_code 锚定，直播一致性）
```

> live 现状 `ObsBar`/`currentPlayerName()` 已从 `JijieData.playerName` 取名（单打）或固定「双打战队」（双打）。P5 接入 = 把「本地 playerName 字符串」升级为「后端 players 记录」，门面签名 `currentPlayerName()` 不变，仅数据源切换——**消费方零改**（研报「同形」原则落地）。读公开（`players` listRule=`""`），观众/OBS 无需登录即可拉。

### 3.3 练习不落库边界

```
ruleMode==='practice'（HomeScreen 练习 tab）：
  全程纯前端闭环，不 POST matches（对齐开放问题拍板：练习默认不落库）
  仅当选手主动点「保存本局」→ POST matches{mode:'practice', payload_code, players可空}
  → Go hook A 见 mode=='practice' 跳过算分（不进天梯）
```

> 边界硬点：`mode` 字段是练习/比赛唯一区分键，前端 `setRuleMode` 的值直接映射 `matches.mode`。练习落库（主动保存）走同一 endpoint 但 `mode='practice'`，hook 凭 `mode` 短路算分——一处分流，前后端一致。

### 3.4 码方案复用（P3 ↔ P5 同一编码器）

- **同一 `encodePayload`/`decodePayload`**：P3 码方案（URL `#hash` 分享）与 P5 `matches.payload_code` 用同一函数。
- 收益：主播可「贴码开局」（`decodePayload` 还原一局 → 直接进 battle）；比赛落库即天然产出可分享码；两条路径零重复代码。
- 版本契约：`payload_ver` 在 URL hash 和 DB 字段都带，解码侧统一校验池长度/哈希，不匹配提示「码版本过期」。

---

## 4. P5 后端 /goal spoke 派发契约草稿

> 形态：dispatch_contract:v1 四段 + marker（agent-dispatch SKILL）。scope = 后端 + 部署；前端 `web/src` 仅**只读对接点**（不在本 round 改前端，前端对接是后续独立 phase）。本契约字符数 >4000，按协议应**外置** `/tmp/dispatch-jjb-p5-backend-<date>.md`，`/goal` 只放一句话 objective + 文件指针。下方给契约全文（hub 落盘用）。
> harness round：用户自有项目方针「尽可能多用」+ 本机硬规则 PR 类 `phases≥3` → 本契约默认开 harness-pro round，`planned_phases=4`。

### 4.1 创建会话命令 / Session 名

```
cd /Users/bytedance/项目/jijiebei && claude -n jjb-p5-backend
```

### 4.2 /goal 命令（spoke 第一条输入，外置指针）

```
/goal 在 /Users/bytedance/项目/jijiebei（分支 jjb-platform）搭建集结杯比赛平台 PocketBase 后端：5 集合 schema + 记录级权限 + 积分/天梯 Go hook + devbox 部署清单 + Litestream 容灾，前端 web/src 仅只读对接、本 round 不改前端代码。完整契约见 /tmp/dispatch-jjb-p5-backend-2026-06-22.md，本回合第一个工具调用必须是 Read 该文件，读全再开工；读不到立即 STOP 报告。
```

### 4.3 契约全文（hub 写入 `/tmp/dispatch-jjb-p5-backend-2026-06-22.md`）

```xml
<!-- dispatch_contract:v1 target=claude-session entry=goal -->
<objective>
  为集结杯比赛平台搭建 PocketBase（SQLite）后端：players/matches/scores/logs/accounts
  5 集合 schema + 记录级权限规则 + 积分/天梯 Go hook + devbox 裸进程部署清单 +
  nginx /api 反代段 + Litestream 容灾配置。产出可在本地起跑验证的后端实例 + 部署 runbook。

  背景：集结杯从「突变随机工具」升级为「比赛平台」（projectplan 2026-06-22 主线）。
  前端 P0 清场 + P1 入口分流/BP 已完成（分支 jjb-platform），P5 后端与前端并行起跑，
  汇流点 = 前端 fetch /api（汇流接线是后续独立 phase，本 round 不做）。
  选型已定稿：PocketBase + Litestream（淘汰 Supabase/Appwrite），见 tmp/platform-research-report.md §1。
  核心原则：架构简洁轻便、数据自掌控可导出、与现有 devbox docker nginx 8080 共存。
</objective>

<scope>
  可以动（新增为主）：
  - 新建后端目录（建议 backend/ 或 server/）：PocketBase Go 嵌入 main.go 或 pb_hooks/ JSVM
  - schema 定义：5 集合（players/matches/scores/logs/accounts）字段 + 索引 + API Rules
    迁移用 PocketBase migrations（pb_migrations/*.go 或 .js），可版本化可重放
  - Go hook：积分计算（matches afterCreate → scores）、天梯聚合（可选 rankings 缓存或 /api/rankings 自定义路由）、审计埋点（logs）
  - 部署产物：deploy/ 下 nginx /api 反代片段、systemd unit 或极简 Dockerfile、litestream.yml 模板、部署 runbook.md
  - 积分系数表 + 赛季标识：配置化（settings 集合或配置文件），不硬编码进 hook

  只读对接点（读懂形状，不改代码）：
  - web/src/logic/jjbSession.ts：SelectState（getSelectState）= 单打整局选择权威形状；SessionMode 11 枚举字符串（game_mode 直存源）；winLoseList（RESULT_VAL lose0/win1/bonus2）；getScore()（win+bonus 计获胜场不双计）
  - web/src/logic/jjbDoubles.ts：DoublesConfig + _slots（cmds/factors）= 双打整局选择权威形状
  - web/src/logic/jjbView.ts：统一门面（currentPlayerName/currentMatches/currentScore），未来前端对接挂这里
  - web/src/screens/HomeScreen.tsx：选手 ID 输入 + 练习/比赛 tab（setRuleMode practice/match → matches.mode 映射源）

  不要动（硬红线，零 diff）：
  - assets/Script、assets/resources、design/、web/src/logic/legacy/（Cocos/XP 遗产冻结）
  - web/src/ 任何现有前端代码（本 round 后端独立产出，前端对接是后续 phase）
  - 现有 vite/nginx 静态托管 location /（只新增 location /api，不改 location /）
  - 不自行 git commit、不自行 push、不部署到真 devbox（产出 runbook 供 hub/yb 拍板执行）
  - 密钥/token 仅走临时 env，不落盘不进 git（Litestream S3 凭证占位 <...>）

  schema 关键约束（对齐 live，禁自创字段语义）：
  - matches.game_mode = 直存 SessionMode 字符串（std8/std10/std12/rescue/one-a/hard1/hard2/feiqiu/suiji/doubles/feiqiu-doubles）
  - matches.payload_code = 单字段存整局索引码（与 P3 码方案复用同一编码，本 round 仅定字段+长度上限（初稿 ~512 → 联调修正 2048，codec 实测≤858），编码器实现属前端/P3）
  - matches.result = 直存 winLoseList JSON 数组
  - matches.mode = practice/match（练习 mode=practice，hook 跳过算分）
  - scores 不接受前端直接写（createRule admin-only，hook 用 superuser dao 写）
  - logs updateRule/deleteRule = null（审计不可改不可删）
  - 读默认公开（players/matches/scores listRule=""，直播/观众无登录可读）
</scope>

<validation>
  done-when：
  - PocketBase 本地起跑（pocketbase serve），Admin UI 可访问，5 集合 + 字段 + API Rules 全部就位
  - migrations 可从零重放建出完整 schema（rm pb_data && migrate up → 5 集合齐）
  - 权限实测：host 账号能 POST matches、viewer 不能写、admin 能改 scores、logs 不可改不可删（curl 逐条验，贴回响）
  - Go hook 实测：手工 POST 一条 mode=match 的 matches（带 result winLoseList）→ 自动派生 scores 记录（delta=获胜场×系数）+ logs 审计条；POST mode=practice 的 matches → 不派生 scores
  - 天梯聚合实测：造 2 局 scores → GET 天梯（/api/rankings 或聚合查询）返回 SUM(delta) GROUP BY player 正确
  - SQLite 可导出：cp pb_data/data.db 出独立文件，sqlite3 打开可查 matches/scores
  - 部署产物齐：nginx /api 反代片段（含 realtime SSE 配置）+ systemd unit/Dockerfile + litestream.yml 模板 + runbook.md（二进制随产物 scp 推、绕开 devbox 外网受限的步骤明确）
  - 前端对接点形状核对正确：runbook 或 README 列出 matches POST payload 字段 ↔ live getSelectState/winLoseList/getScore 的映射表（证明 schema 与 live 同形）

  proof（spoke 必须运行并贴回原文）：
  <pre lang="bash">
  cd /Users/bytedance/项目/jijiebei/backend && ./pocketbase serve --http 127.0.0.1:8090 &
  # 1) migrations 重放
  rm -rf pb_data && ./pocketbase migrate up && ls pb_migrations/
  # 2) 建 admin + host + viewer 账号，逐角色 curl 验权限矩阵
  # 3) POST 一局 match(mode=match,result=[1,2,0]) → 回读 scores 派生 + logs 审计
  curl -s -X POST http://127.0.0.1:8090/api/collections/matches/records -H "Authorization: <host-token>" -d '{...}' | jq .
  curl -s "http://127.0.0.1:8090/api/collections/scores/records?filter=(match='<id>')" | jq .
  # 4) practice 局不派生 scores 的反证
  # 5) cp pb_data/data.db /tmp/export.db && sqlite3 /tmp/export.db ".tables"
  </pre>
  把上述每步真实输出贴回响（不许只描述）。

  【六硬约束】①不跳 phase 顺序②review/gate/audit 只许驱动 session 经 CLI 产生，禁手写代跑③frozen 与 runtime 目录只读④禁伪造 PASS⑤证据只引 pre-review 事实⑥不确定/失败/超预算→停下汇报
</validation>

<stop_when>
  - 发现需要改 web/src 现有前端代码才能完成（前端对接是后续 phase）→ STOP 报告，不自行改前端
  - 发现需要改 assets/Script、assets/resources、design/、web/src/logic/legacy/ → STOP（冻结红线）
  - 需要真实 devbox 部署 / 真实 S3 凭证 / 真实公网暴露 → STOP（产出 runbook 供 hub 拍板，不自行操作外部状态）
  - 契约文件 /tmp/dispatch-jjb-p5-backend-2026-06-22.md Read 失败或为空 → 立即 STOP 报告，不凭残缺上下文执行
  - PocketBase 版本行为与契约假设冲突（如 hook API 签名变更）→ 先 STOP 核 live 文档再续
  - harness round 内任一 phase gate BLOCKED 且非假阳性 → STOP 交 hub 收口（参考 projectplan P3/P4/P5 evidence 截断假阳性家族，BLOCKED 先判真伪）
  max_iterations: 30
  max_duration: 4h
</stop_when>

<context>
  必须先读（按序）：
  - /Users/bytedance/项目/jijiebei/tmp/platform-research-report.md（§1 选型 / §2 架构 / §5 schema 草案）
  - /Users/bytedance/项目/jijiebei/projectplan.md（搜「6 Phase 路线图」「数据 schema」「开放问题决策」「P0 架构清场 完成记录」）
  - web/src/logic/jjbSession.ts（SelectState 定义在 export interface SelectState；SessionMode 在 :64）
  - web/src/logic/jjbDoubles.ts（DoublesConfig + _slots）
  - web/src/logic/jjbView.ts（门面）

  已定真相（不要重新论证）：
  - 选型 = PocketBase + Litestream，SQLite 非 Postgres（读多写少单机写串行）
  - 积分 = 最简（每局获胜场 × 难度系数纯累加 + 赛季 SUM），Elo 后续；系数表配置化
  - 练习默认不落库（mode=practice 主动保存才写，hook 跳过算分）
  - 天梯不单独建表 = scores 按 season 聚合
  - 部署 = devbox-tianlang 10.37.220.128 docker nginx 8080；外网受限→二进制随产物 scp 推；公网严禁内网穿透
  - PocketBase Go 嵌入优先（单二进制、与「随产物推」一致）；JSVM pb_hooks 为备选
</context>

<motivation>
  这是集结杯从工具升级为比赛平台的后端地基（P5），与前端 P1-P4 并行的独立泳道。
  schema 与 live 选择状态同形是「可扩展」留口的关键——届时前端「读本地 TS 常量」换「fetch /api」
  消费方签名不变。数据自掌控（SQLite 文件 cp 即导出 + Litestream 容灾）是用户硬诉求。
  做对一次，后续积分/天梯/前端对接都在此之上加 hook、加接线，不返工。
</motivation>

<persistence>
  Keep going until fully resolved. Don't hand back on uncertainty.
  Make reasonable assumptions and document them.
  服从 stop_when 优先于 persistence。
</persistence>
```

### 4.4 入口建议

- **入口类型**：新 Claude Code session + `/goal`（copy-paste 路径）——后端写代码 + 改外部状态雏形，需 hub 审一遍再粘（dispatch hard rule 6）。**不用 subagent**（subagent 默认 read-only，后端要写文件）。
- **不用 Codex**：本任务多轮澄清（PocketBase hook API 形状需 live 探查 + harness round），Claude session 更合（路由矩阵「长跑+多轮澄清/harness round → 新 Claude session」）。
- **契约外置**：>4000 字符，hub 用 Write 落 `/tmp/dispatch-jjb-p5-backend-2026-06-22.md`（即最终版，给路径不算分两条钓鱼）；execute prompt 第 1 条强制 Read 该文件。
- **harness round**：默认开，`planned_phases=4`（① schema+migrations ② 权限规则 ③ Go hook 积分/天梯/审计 ④ 部署产物+Litestream），reviewer 用 Dubhe panel alias（live probe `/v1/models`，禁 `mh-`/`wa-`/`seed-` internal key）。
- **harness round 后续接线（不在本契约）**：前端 fetch `/api` 对接（改 `web/src/logic` 新增 `backend.ts` + ObsBar 选手 ID 接 players）= 独立 phase，需用户授权改前端后另派；P3 码方案编码器须先就绪（payload_code 复用）。

---

## 关键文件绝对路径速查

- 选择状态权威（payload_code 编码源）：`/Users/bytedance/项目/jijiebei/web/src/logic/jjbSession.ts`（`SelectState` interface + `getSelectState()` + `SessionMode`:64 + `getScore()`:458 + `winLoseList`/`RESULT_VAL`）
- 双打选择状态：`/Users/bytedance/项目/jijiebei/web/src/logic/jjbDoubles.ts`（`DoublesConfig`:127 + `_slots`:51 + `doublesStart`/`doublesLive`）
- 统一门面（前端对接挂点）：`/Users/bytedance/项目/jijiebei/web/src/logic/jjbView.ts`（`currentPlayerName`:57 / `currentMatches`:32 / `currentScore`:36）
- 落库源字段：`/Users/bytedance/项目/jijiebei/web/src/logic/legacy/JijieData.ts`（全静态态：playerName/mapList/lockFactorList/selectedFactorList/selectedCommanderList/winLoseList/winCount/winbCount）
- 入口分流（mode 映射源）：`/Users/bytedance/项目/jijiebei/web/src/screens/HomeScreen.tsx`（`setRuleMode` practice/match :38 + 选手 ID 输入 :109-113）
- 选择屏（选择真实形状）：`/Users/bytedance/项目/jijiebei/web/src/screens/SelectScreen.tsx`
- 调研报告：`/Users/bytedance/项目/jijiebei/tmp/platform-research-report.md`（§1 选型 / §2 架构 / §5 schema）
- 路线图 + 决策真相：`/Users/bytedance/项目/jijiebei/projectplan.md`（「6 Phase 路线图」「数据 schema」「开放问题决策」「P0 架构清场 完成记录」「P1 进度」节）
- 派发协议：`/Users/bytedance/.claude/skills/agent-dispatch/SKILL.md`（契约四段 + marker + 外置 >4000 字符配方）
- 待落盘契约（hub Write）：`/tmp/dispatch-jjb-p5-backend-2026-06-22.md`

## 三处需 hub/yb 拍板的 caveat

1. **CF Pages 跨域** vs **devbox nginx 同源**：P5 本 round 只在 devbox 内做 `/api` 同源反代（建议 2.4-a）；CF Pages 前端连后端的跨域/公网暴露受内网穿透红线约束，须 SRE 走 TLB，是独立后续事项，**不阻塞 P5 本地/devbox 联通**，但 yb 需知「CF Pages 前端 + devbox 后端」最终拓扑要单独定。
2. **payload_code 编码器归属**：P3（码方案）与 P5（落库）复用同一编码器。本 P5 契约只定 `matches.payload_code` 字段 + 长度上限，**编码器实现属前端/P3**——若 P3 未先做，P5 落库可先存「完整 JSON 快照」过渡，待 P3 编码器就绪再切索引码（schema 字段不变，仅内容形态过渡）。建议 P3 先于「前端落库接线」完成。
3. **积分难度系数表未定稿**（开放问题 #1）：契约取最简（std8=1.0…rescue/hard=1.3，纯累加）+ 系数配置化。真实系数（点金×2 是否计分 / 双打系数 / 连胜加成 / 赛季周期）须 yb/土豆拍板——schema 用 `delta+reason+season` 已留足空间，系数改不动 schema，但**天梯上线前必须定稿系数**，否则积分无意义。

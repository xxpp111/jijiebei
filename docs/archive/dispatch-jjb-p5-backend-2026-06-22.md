# 集结杯 P5 后端派发契约（PocketBase）— Claude Code + GLM-5.2 spoke

> **执行位**：Claude Code 底座切 **GLM-5.2**（经 Dubhe 三方网关，临时 env）。
> **⚠️ 纯文本工作，禁止任何图片/截图/二进制输入**——上一轮本任务因误贴图片触发 `400 messages[].content[].type 类型错误` 崩 session，本轮绝不重蹈：只处理文本，遇图忽略、不喂给模型。
> **本文件即 `/goal` 目标全文**：spoke 本回合**第一个工具调用必须 Read 本文件**，读全再开工；读不到或为空立即 STOP 报告。
> **harness-pro round 约束**：planned_phases=4（见末尾「Harness-Pro Round 执行配方」）。
> 真相基线：`tmp/platform-research-report.md`（§1/§2/§5）+ `projectplan.md`（6 Phase 路线图 / 数据 schema / 开放问题决策 / P0·P1 完成记录）+ `docs/research-backend-p5.md`（**schema 字段级细化 + 权限矩阵 + Go hook 伪码 + 部署清单全文**，本契约的展开版，务必先读）。

<!-- dispatch_contract:v1 target=claude-session entry=goal exec_model=glm-5.2 harness=on planned_phases=4 -->

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
  - 密钥/token 仅走临时 env，不落盘不进 git（Litestream S3 凭证占位 <...>；Dubhe key 同理）

  schema 关键约束（对齐 live，禁自创字段语义）：
  - matches.game_mode = 直存 SessionMode 字符串（std8/std10/std12/rescue/one-a/hard1/hard2/feiqiu/suiji/doubles/feiqiu-doubles）
  - matches.payload_code = 单字段存整局索引码（与 P3 码方案复用同一编码，本 round 仅定字段+长度上限~512，编码器实现属前端/P3）
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

  proof（spoke 必须运行并贴回原文，不许只描述）：
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

  【六硬约束】①不跳 phase 顺序 ②review/gate/audit 只许驱动 session 经 CLI 产生，禁手写代跑 ③frozen 与 runtime 目录只读 ④禁伪造 PASS ⑤证据只引 pre-review 事实 ⑥不确定/失败/超预算→停下汇报
</validation>

<stop_when>
  - 发现需要改 web/src 现有前端代码才能完成（前端对接是后续 phase）→ STOP 报告，不自行改前端
  - 发现需要改 assets/Script、assets/resources、design/、web/src/logic/legacy/ → STOP（冻结红线）
  - 需要真实 devbox 部署 / 真实 S3 凭证 / 真实公网暴露 → STOP（产出 runbook 供 hub 拍板，不自行操作外部状态）
  - 本契约文件 Read 失败或为空 → 立即 STOP 报告，不凭残缺上下文执行
  - PocketBase 版本行为与契约假设冲突（如 hook API 签名变更）→ 先 STOP 核 live 文档再续
  - harness round 内任一 phase gate BLOCKED 且非假阳性 → STOP 交 hub 收口（先判 BLOCKED 真伪：参考 projectplan evidence 截断假阳性家族）
  - Dubhe 网关不可达 / DUBHE_API_KEY 失效 / reviewer alias live probe 失败 → STOP 报告
  - ⚠️ 收到任何图片/截图/二进制输入 → 不处理、纯文本继续；若底座 API 报 content type / 400 → 立即 STOP 报告（这是上一轮崩 session 的根因，绝不重蹈）
  - 重派注意：上一轮已建 backend/go.mod（可复用或覆盖）；旧 .harness-pro runtime 已废，本轮重新 init 新 runtime
  max_iterations: 30
  max_duration: 4h
</stop_when>

<context>
  必须先读（按序）：
  - /Users/bytedance/项目/jijiebei/docs/research-backend-p5.md（本契约展开版：schema 字段级表 + 权限矩阵 + Go hook 伪码 + 部署 2.1-2.5 + 前端对接 3.x）
  - /Users/bytedance/项目/jijiebei/tmp/platform-research-report.md（§1 选型 / §2 架构 / §5 schema 草案）
  - /Users/bytedance/项目/jijiebei/projectplan.md（搜「6 Phase 路线图」「数据 schema」「开放问题决策」「P0 架构清场 完成记录」）
  - web/src/logic/jjbSession.ts（SelectState 定义 + SessionMode:64 + getScore + winLoseList/RESULT_VAL）
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

---

## Harness-Pro Round 执行配方（planned_phases=4）

本任务 = 写 repo + 产 runtime artifact → **默认进 harness-pro round**。协议唯一真相源 = `harness-pro` skill + repo-local adapter（`HARNESS-PRO-ADAPTER.md` 及其 amendment）；下方是本机硬规则与配方框架，**当前真相以 skill/adapter live 注记为准**。

### 起跑前自检（doctor + live probe，先做）
- 先 invoke `harness-pro` skill，读 repo adapter 拿当前真相源：**config 文件名（reviewer/exec/host-allowlist）、reviewer 组合、gate-policy、host backend**。
- `npx harness-pro doctor`（或 adapter 指定等价命令）确认 runtime 健康。
- **live probe Dubhe `/v1/models`** 拿实际可用 alias（不只 grep YAML）：执行底座是 **glm-5.2**，**reviewer panel 必须与 glm-5.2 disjoint**（同源自审产假阳性）；reviewer alias 用 adapter 当前注记的合法 alias，不臆测前缀黑白名单——以 live probe + adapter 为准。
- 关键 payload shape（PocketBase hook API 签名、migrations 形态）起跑前 live probe/核文档一次。

### init（Dubhe env 临时，不落盘不进 git）
```bash
export DUBHE_API_KEY=<key>                       # 临时 env
export DUBHE_API_BASE=http://127.0.0.1:8686/v1
npx harness-pro init --goal "集结杯 P5 PocketBase 后端：5集合schema+权限+积分天梯hook+部署清单+Litestream" \
  --phases 4 --scaffold claude-code --gate-policy majority \
  --reviewer-config <repo 现有 reviewer config，以 adapter 真相为准> \
  --model-config <repo 现有 eval-models config，以 adapter 真相为准>
RT=<init 生成的 .harness-pro-* 目录>             # 立即记录；后续每条 CLI 显式 --runtime-dir "$RT"
```

### 4 phase 划分
1. **schema + migrations**：5 集合字段 + 索引 + migrations 可从零重放（rm pb_data && migrate up → 5 集合齐）。
2. **记录级权限规则**：API Rules 矩阵（读公开 / host 写 matches / scores admin-only / logs 不可改删）+ curl 逐角色实测贴回。
3. **Go hook**：积分计算（matches afterCreate→scores，mode=practice 跳过）+ 天梯聚合 + 审计埋点（logs）+ 系数配置化。
4. **部署产物**：nginx /api 反代片段（含 realtime SSE）+ systemd unit/Dockerfile + litestream.yml + runbook.md（二进制随产物 scp 推、绕开外网受限步骤明确）。

每 phase：`phase → work → runVerify → review(显式 --model-config) → record-gate`（**全部显式 `--runtime-dir "$RT"`**）。末 phase：`stop → audit`（目标 native_harness_pass）。

### harness 硬性注意（实测教训）
- init 后**每条 CLI 显式 `--runtime-dir "$RT"`**（多 runtime 并存时省略按 mtime 误中别的 lane）。
- review **必须显式 `--model-config`**（否则 core 默认解析自家 config、缺本仓 key 的 reviewer 静默回退 stub）。
- **确定性验证才是真 gate**：PocketBase 起跑 + migrations 重放 + 权限 curl 矩阵 + hook 落库回读 + SQLite 导出，全部真实跑过贴回；reviewer verdict 走 advisory，不拿 reviewer PASS 当上线许可。
- secret scan 覆盖实际 env-value literal（Dubhe key / S3 凭证），不只通用 key-shaped regex。

---

## 关键文件绝对路径速查
- 选择状态权威（payload_code 编码源）：`web/src/logic/jjbSession.ts`（SelectState interface + getSelectState + SessionMode:64 + getScore:458 + winLoseList/RESULT_VAL）
- 双打选择状态：`web/src/logic/jjbDoubles.ts`（DoublesConfig:127 + _slots:51 + doublesStart/doublesLive）
- 统一门面（前端对接挂点）：`web/src/logic/jjbView.ts`（currentPlayerName:57 / currentMatches:32 / currentScore:36）
- 落库源字段：`web/src/logic/legacy/JijieData.ts`（playerName/mapList/lockFactorList/selectedFactorList/selectedCommanderList/winLoseList/winCount/winbCount）
- 入口分流（mode 映射源）：`web/src/screens/HomeScreen.tsx`（setRuleMode practice/match:38 + 选手 ID 输入:109-113）
- schema 细化全文：`docs/research-backend-p5.md`
- 调研报告：`tmp/platform-research-report.md`（§1 选型 / §2 架构 / §5 schema）
- 路线图 + 决策：`projectplan.md`
- 派发协议：`/Users/bytedance/.claude/skills/agent-dispatch/SKILL.md`

## 三处需 hub/yb 拍板的 caveat（spoke 遇到标记后 STOP/留 runbook，不自决）
1. **CF Pages 跨域 vs devbox nginx 同源**：本 round 只在 devbox 内做 `/api` 同源反代（research-backend-p5 §2.4-a）；CF Pages 前端连后端的公网暴露受内网穿透红线约束、须 SRE 走 TLB，是独立后续事项，不阻塞 P5 本地/devbox 联通——runbook 标注最终拓扑待 yb 定。
2. **payload_code 编码器归属**：P3（码方案）与 P5（落库）复用同一编码器。本契约只定 `matches.payload_code` 字段 + 长度上限；编码器实现属前端/P3。若 P3 未先做，P5 落库可先存「完整 JSON 快照」过渡（schema 字段不变，仅内容形态过渡），runbook 写明切换点。
3. **积分难度系数表未定稿**（开放问题 #1）：契约取最简（std8=1.0…rescue/hard=1.3，纯累加）+ 系数配置化。真实系数（点金×2 是否计分/双打系数/连胜加成/赛季周期）须 yb/土豆拍板——schema 用 delta+reason+season 已留空间，系数改不动 schema，但天梯上线前必须定稿。
